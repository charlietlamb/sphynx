import { describe, expect, test } from "bun:test";
import { HttpClient, HttpClientResponse } from "@effect/platform";
import {
  GitHubRateLimited,
  PullRequestNotFound,
} from "@sphynx/schema/pull-requests";
import {
  Duration,
  Effect,
  Fiber,
  Layer,
  Redacted,
  TestClock,
  TestContext,
} from "effect";
import { GitHubClient, GitHubClientLive } from "./client";
import { GitHubConfig } from "./config";

const ref = { owner: "useautumn", repo: "autumn", number: 2229 } as const;
const TOKEN = "ghs_test";

const config = Layer.succeed(GitHubConfig, {
  apiUrl: "https://api.github.test",
  apiVersion: "2022-11-28",
  timeout: Duration.seconds(1),
  webhookSecrets: [Redacted.make("test-webhook-secret")],
  app: {
    appId: "1",
    clientId: "Iv1.test",
    privateKey: Redacted.make("test-key"),
  },
});

const runWith = <A>(
  respond: Parameters<typeof HttpClient.make>[0],
  effect: (client: GitHubClient["Type"]) => Effect.Effect<A, unknown>
) =>
  Effect.gen(function* () {
    const client = yield* GitHubClient;
    return yield* effect(client);
  }).pipe(
    Effect.provide(
      GitHubClientLive.pipe(
        Layer.provide(
          Layer.mergeAll(
            config,
            Layer.succeed(HttpClient.HttpClient, HttpClient.make(respond))
          )
        )
      )
    ),
    Effect.runPromise
  );

const json = (
  request: Parameters<Parameters<typeof HttpClient.make>[0]>[0],
  body: unknown,
  init?: ResponseInit
) =>
  HttpClientResponse.fromWeb(
    request,
    new Response(JSON.stringify(body), {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
    })
  );

describe("GitHubClient", () => {
  test("normalizes a pull request", async () => {
    const result = await runWith(
      (request) =>
        Effect.succeed(
          json(
            request,
            {
              number: 2229,
              title: "release",
              body: null,
              state: "closed",
              draft: false,
              user: { login: "charlie", avatar_url: "https://avatar.test" },
              base: {
                ref: "main",
                sha: "base",
                repo: {
                  id: 1,
                  name: "autumn",
                  html_url: "https://github.com/useautumn/autumn",
                  owner: { login: "useautumn" },
                },
              },
              head: { ref: "release", sha: "head" },
              commits: 34,
              changed_files: 278,
              additions: 34_943,
              deletions: 949,
              comments: 3,
              review_comments: 40,
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-02T00:00:00Z",
              merged_at: "2026-01-03T00:00:00Z",
              html_url: "https://github.com/useautumn/autumn/pull/2229",
            },
            { headers: { etag: '"pull"' } }
          )
        ),
      (client) => client.getPullRequest(TOKEN, ref)
    );

    expect(result).toMatchObject({
      _tag: "Modified",
      etag: '"pull"',
      value: {
        state: "merged",
        repository: { owner: "useautumn", name: "autumn" },
        stats: { changedFiles: 278 },
      },
    });
  });

  test("maps files and Link pagination", async () => {
    const result = await runWith(
      (request) =>
        Effect.succeed(
          json(
            request,
            [
              {
                sha: "file",
                filename: "old.ts",
                status: "removed",
                additions: 0,
                deletions: 2,
                changes: 2,
                blob_url: "https://github.com/file",
              },
            ],
            {
              headers: {
                link: '<https://api.github.test/files?page=2>; rel="next"',
              },
            }
          )
        ),
      (client) => client.listPullRequestFiles(TOKEN, ref, 1)
    );

    expect(result).toMatchObject({
      _tag: "Modified",
      value: {
        nextPage: 2,
        files: [
          {
            status: "deleted",
            renderability: "binary-or-large",
          },
        ],
      },
    });
    expect(result._tag === "Modified" && "patch" in result.value.files[0]).toBe(
      false
    );
  });

  test("authorizes every request", async () => {
    let seen: string | undefined;
    await runWith(
      (request) => {
        seen = request.headers.authorization;
        return Effect.succeed(json(request, { content: "" }));
      },
      (client) => client.getFileContents(TOKEN, ref, "src/a.ts", "sha")
    );
    expect(seen).toBe(`Bearer ${TOKEN}`);
  });

  test("collects patches across pages and indexes their symbols", async () => {
    const pages = [
      [
        {
          sha: "a",
          filename: "src/first.ts",
          status: "modified",
          additions: 1,
          deletions: 0,
          changes: 1,
          blob_url: "https://github.com/a",
          patch: "@@ -1 +1 @@\n+export function computeTotal() {}",
        },
        {
          sha: "b",
          filename: "logo.png",
          status: "modified",
          additions: 0,
          deletions: 0,
          changes: 0,
          blob_url: "https://github.com/b",
        },
      ],
      [
        {
          sha: "c",
          filename: "src/second.ts",
          status: "added",
          additions: 1,
          deletions: 0,
          changes: 1,
          blob_url: "https://github.com/c",
          patch: "@@ -0,0 +1 @@\n+export class PaymentGateway {}",
        },
      ],
    ];
    const result = await runWith(
      (request) => {
        const page = Number(new URL(request.url).searchParams.get("page"));
        return Effect.succeed(
          json(
            request,
            pages[page - 1],
            page === 1
              ? {
                  headers: {
                    link: '<https://api.github.test/files?page=2>; rel="next"',
                  },
                }
              : undefined
          )
        );
      },
      (client) => client.listAllPatches(TOKEN, ref)
    );

    expect(Object.keys(result.patches).sort()).toEqual([
      "src/first.ts",
      "src/second.ts",
    ]);
    expect(result.files.map((file) => file.path).sort()).toEqual([
      "logo.png",
      "src/first.ts",
      "src/second.ts",
    ]);
    expect(
      result.files.find((file) => file.path === "logo.png")?.renderability
    ).toBe("binary-or-large");
    expect(result.symbols.computeTotal).toMatchObject({
      kind: "top",
      path: "src/first.ts",
    });
    expect(result.symbols.PaymentGateway?.path).toBe("src/second.ts");
  });

  test("fetches later file pages in parallel when rel=last is present", async () => {
    const pages = [
      [
        {
          sha: "a",
          filename: "src/p1.ts",
          status: "modified",
          additions: 1,
          deletions: 0,
          changes: 1,
          blob_url: "https://github.com/a",
          patch: "@@ -1 +1 @@\n+one",
        },
      ],
      [
        {
          sha: "b",
          filename: "src/p2.ts",
          status: "modified",
          additions: 1,
          deletions: 0,
          changes: 1,
          blob_url: "https://github.com/b",
          patch: "@@ -1 +1 @@\n+two",
        },
      ],
      [
        {
          sha: "c",
          filename: "src/p3.ts",
          status: "modified",
          additions: 1,
          deletions: 0,
          changes: 1,
          blob_url: "https://github.com/c",
          patch: "@@ -1 +1 @@\n+three",
        },
      ],
    ];
    const requested: number[] = [];
    const result = await runWith(
      (request) => {
        const page = Number(new URL(request.url).searchParams.get("page"));
        requested.push(page);
        return Effect.succeed(
          json(
            request,
            pages[page - 1],
            page === 1
              ? {
                  headers: {
                    link: '<https://api.github.test/files?page=3>; rel="last"',
                  },
                }
              : undefined
          )
        );
      },
      (client) => client.listAllPatches(TOKEN, ref)
    );

    expect(requested.sort((a, b) => a - b)).toEqual([1, 2, 3]);
    expect(result.files.map((file) => file.path)).toEqual([
      "src/p1.ts",
      "src/p2.ts",
      "src/p3.ts",
    ]);
  });

  test("returns typed GitHub failures", async () => {
    const notFound = await runWith(
      (request) =>
        Effect.succeed(
          HttpClientResponse.fromWeb(
            request,
            new Response(null, { status: 404 })
          )
        ),
      (client) => client.getPullRequest(TOKEN, ref).pipe(Effect.flip)
    );
    expect(notFound).toBeInstanceOf(PullRequestNotFound);

    let attempts = 0;
    const rateLimitedResponse = (
      request: Parameters<Parameters<typeof HttpClient.make>[0]>[0]
    ) => {
      attempts += 1;
      return Effect.succeed(
        HttpClientResponse.fromWeb(
          request,
          new Response(null, {
            status: 403,
            headers: {
              "retry-after": "30",
              "x-ratelimit-remaining": "0",
              "x-ratelimit-reset": "1800000000",
            },
          })
        )
      );
    };
    /**
     * Under TestClock the rate-limit backoff sleeps virtual time: fork the call,
     * fast-forward past the (clamped 60s) waits, and read the surfaced error —
     * so the retry path is exercised without real seconds of delay.
     */
    const limited = await Effect.gen(function* () {
      const client = yield* GitHubClient;
      const fiber = yield* client
        .getPullRequest(TOKEN, ref)
        .pipe(Effect.flip, Effect.fork);
      yield* TestClock.adjust(Duration.minutes(5));
      return yield* Fiber.join(fiber);
    }).pipe(
      Effect.provide(
        GitHubClientLive.pipe(
          Layer.provide(
            Layer.mergeAll(
              config,
              Layer.succeed(
                HttpClient.HttpClient,
                HttpClient.make(rateLimitedResponse)
              )
            )
          )
        )
      ),
      Effect.provide(TestContext.TestContext),
      Effect.runPromise
    );
    expect(limited).toBeInstanceOf(GitHubRateLimited);
    if (limited._tag === "GitHubRateLimited") {
      expect(limited.retryAfterSeconds).toBe(30);
    }
    // The rate-limit is retried (honoring Retry-After) before it surfaces.
    expect(attempts).toBeGreaterThan(1);
  });
});
