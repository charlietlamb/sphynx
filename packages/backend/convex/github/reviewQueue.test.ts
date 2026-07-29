import { Effect } from "effect";
import { describe, expect, test, vi } from "vitest";
import type { GitHubClient } from "./githubClient";
import { MAX_PIPELINE_PULLS } from "./limits";
import { makeReviewQueue } from "./reviewQueue";

const rawPull = (number: number) => ({
  number,
  title: `Pull ${number}`,
  bodyHTML: null,
  isDraft: false,
  updatedAt: "2026-07-01T00:00:00Z",
  additions: 1,
  deletions: 0,
  changedFiles: 1,
  headRefName: `feature-${number}`,
  baseRefName: "main",
  author: null,
  statusCheckRollup: null,
  reviews: { totalCount: 0, nodes: [] },
  reviewThreads: { totalCount: 0, nodes: [] },
  comments: { totalCount: 0, nodes: [] },
});

describe("review queue pagination", () => {
  test("walks every open-pull connection page", async () => {
    const query = vi.fn(
      (
        _token: string,
        _schema: unknown,
        _document: string,
        variables: Record<string, unknown>
      ) =>
        Effect.succeed({
          repository: {
            pullRequests:
              variables.after === null
                ? {
                    nodes: [rawPull(2)],
                    pageInfo: { hasNextPage: true, endCursor: "next" },
                  }
                : {
                    nodes: [rawPull(1)],
                    pageInfo: { hasNextPage: false, endCursor: null },
                  },
          },
        })
    );
    const client = { query } as unknown as GitHubClient;
    const pulls = await Effect.runPromise(
      makeReviewQueue(client).openPullsForRepos(
        [{ owner: "acme", repo: "widgets" }],
        "token"
      )
    );

    expect(pulls.get("acme/widgets")?.map((pull) => pull.number)).toEqual([
      2, 1,
    ]);
    expect(query).toHaveBeenCalledTimes(2);
  });

  test("fails instead of returning a partial oversized installation", async () => {
    let page = 0;
    const query = vi.fn(() => {
      page += 1;
      return Effect.succeed({
        repository: {
          pullRequests: {
            nodes: Array.from({ length: 100 }, (_, index) =>
              rawPull(page * 100 + index)
            ),
            pageInfo: { hasNextPage: true, endCursor: String(page) },
          },
        },
      });
    });
    const client = { query } as unknown as GitHubClient;

    await expect(
      Effect.runPromise(
        makeReviewQueue(client).openPullsForRepos(
          [{ owner: "acme", repo: "widgets" }],
          "token"
        )
      )
    ).rejects.toMatchObject({
      message: `Installation exceeds the ${MAX_PIPELINE_PULLS} open pull request materialization limit`,
    });
    expect(query).toHaveBeenCalledTimes(3);
  });
});
