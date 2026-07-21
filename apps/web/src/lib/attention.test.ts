import { describe, expect, test } from "bun:test";
import type {
  QueuePull,
  RepoFlow,
  ReviewerVerdict,
} from "@sphynx/schema/review-queue";
import {
  buildBranchQueue,
  filterQueue,
  pullScores,
  railBranches,
  sizeClass,
} from "@/lib/attention";

function reviewer(overrides: Partial<ReviewerVerdict>): ReviewerVerdict {
  return {
    name: "cubic-dev-ai[bot]",
    kind: "bot",
    avatarUrl: null,
    state: "commented",
    score: null,
    submittedAt: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

function pull(overrides: Partial<QueuePull>): QueuePull {
  return {
    owner: "acme",
    repo: "widgets",
    number: 1,
    title: "Test pull",
    hasBody: false,
    author: null,
    isDraft: false,
    state: "open",
    mergedAt: null,
    updatedAt: "2026-07-01T00:00:00Z",
    additions: 10,
    deletions: 5,
    changedFiles: 2,
    ci: "success",
    headRefName: "feature/a",
    baseRefName: "dev",
    reviewers: [],
    reviewerCount: 0,
    botReviewerCount: 0,
    approvals: 0,
    changesRequested: 0,
    unresolvedThreads: 0,
    ciFailures: [],
    ciCounts: { failed: 0, passed: 0, pending: 0 },
    threadPreviews: [],
    decision: "needs-eyes",
    blocker: null,
    ...overrides,
  };
}

function flow(
  pulls: QueuePull[],
  stages: string[] = ["dev", "main"]
): RepoFlow {
  return { owner: "acme", repo: "widgets", stages, openPulls: pulls, gaps: [] };
}

describe("pullScores", () => {
  test("orders scores by submission time, oldest first", () => {
    const scores = pullScores(
      pull({
        reviewers: [
          reviewer({
            name: "greptile[bot]",
            score: "4/5",
            submittedAt: "2026-07-02T00:00:00Z",
          }),
          reviewer({ score: "2/5", submittedAt: "2026-07-01T00:00:00Z" }),
        ],
      })
    );
    expect(scores.map((score) => score.label)).toEqual(["2/5", "4/5"]);
    expect(scores.at(-1)?.reviewer).toBe("greptile[bot]");
  });

  test("skips reviewers without scores and malformed scores", () => {
    const scores = pullScores(
      pull({
        reviewers: [
          reviewer({ score: null }),
          reviewer({ name: "b", score: "great" }),
          reviewer({ name: "c", score: "3/5" }),
        ],
      })
    );
    expect(scores).toHaveLength(1);
    expect(scores[0]?.ratio).toBeCloseTo(0.6);
  });
});

describe("sizeClass", () => {
  test("buckets by total changed lines", () => {
    expect(sizeClass(pull({ additions: 3, deletions: 2 }))).toBe("xs");
    expect(sizeClass(pull({ additions: 1400, deletions: 200 }))).toBe("xl");
  });
});

describe("buildBranchQueue", () => {
  test("groups pulls by base branch with stacks nested under roots", () => {
    const root = pull({ number: 1, headRefName: "feat/a", baseRefName: "dev" });
    const child = pull({
      number: 2,
      headRefName: "feat/b",
      baseRefName: "feat/a",
    });
    const queue = buildBranchQueue(flow([root, child]));
    expect(queue.groups).toHaveLength(1);
    expect(queue.groups[0]?.branch).toBe("dev");
    expect(queue.groups[0]?.total).toBe(2);
    expect(queue.groups[0]?.nodes[0]?.children[0]?.pull.number).toBe(2);
    expect(queue.order).toEqual(["acme/widgets#1", "acme/widgets#2"]);
  });

  test("groups a pull targeting a stage under that stage, not the promotion", () => {
    const promotion = pull({
      number: 1,
      headRefName: "dev",
      baseRefName: "main",
    });
    const targetingDev = pull({
      number: 2,
      headRefName: "feat/x",
      baseRefName: "dev",
    });
    const queue = buildBranchQueue(flow([promotion, targetingDev]));
    const dev = queue.groups.find((group) => group.branch === "dev");
    const main = queue.groups.find((group) => group.branch === "main");
    expect(dev?.total).toBe(1);
    expect(dev?.nodes[0]?.pull.number).toBe(2);
    expect(main?.total).toBe(1);
    expect(main?.nodes[0]?.pull.number).toBe(1);
    expect(main?.nodes[0]?.children).toHaveLength(0);
  });

  test("ranks contested before ready before drafts within a branch", () => {
    const draft = pull({ number: 1, headRefName: "a", isDraft: true });
    const ready = pull({ number: 2, headRefName: "b", decision: "ready" });
    const contested = pull({
      number: 3,
      headRefName: "c",
      decision: "contested",
    });
    const queue = buildBranchQueue(flow([draft, ready, contested]));
    expect(queue.order).toEqual([
      "acme/widgets#3",
      "acme/widgets#2",
      "acme/widgets#1",
    ]);
  });

  test("counts mergeable and contested pulls per group", () => {
    const queue = buildBranchQueue(
      flow([
        pull({ number: 1, headRefName: "a", decision: "ready" }),
        pull({ number: 2, headRefName: "b", decision: "contested" }),
        pull({ number: 3, headRefName: "c", isDraft: true, decision: "ready" }),
      ])
    );
    expect(queue.groups[0]?.mergeable).toBe(1);
    expect(queue.groups[0]?.contested).toBe(1);
  });
});

describe("filterQueue", () => {
  test("keeps only the requested branch and rebuilds order", () => {
    const queue = buildBranchQueue(
      flow([
        pull({ number: 1, headRefName: "a", baseRefName: "dev" }),
        pull({ number: 2, headRefName: "b", baseRefName: "main" }),
      ])
    );
    const filtered = filterQueue(queue, "main");
    expect(filtered.groups.map((group) => group.branch)).toEqual(["main"]);
    expect(filtered.order).toEqual(["acme/widgets#2"]);
  });

  test("returns the queue unchanged without a branch filter", () => {
    const queue = buildBranchQueue(flow([pull({})]));
    expect(filterQueue(queue, null)).toBe(queue);
  });
});

describe("railBranches", () => {
  test("lists stages first, then feature bases with open pulls", () => {
    const queue = buildBranchQueue(
      flow([
        pull({ number: 1, headRefName: "a", baseRefName: "main" }),
        pull({ number: 2, headRefName: "b", baseRefName: "feature/base" }),
      ])
    );
    const items = railBranches(flow([]), queue);
    expect(items.map((item) => item.branch)).toEqual([
      "dev",
      "main",
      "feature/base",
    ]);
    expect(items[0]?.total).toBe(0);
    expect(items[1]?.total).toBe(1);
    expect(items[2]?.isStage).toBe(false);
  });
});
