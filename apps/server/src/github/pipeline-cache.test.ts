import { describe, expect, test } from "bun:test";
import { GitHubRateLimited } from "@sphynx/schema/pull-requests";
import { Effect, Layer, Ref } from "effect";
import type { GitHubCredential } from "./credential";
import { GitHubPipeline } from "./pipeline";
import { PipelineCache, PipelineCacheLive } from "./pipeline-cache";

function stubPipeline(
  calls: Ref.Ref<number>,
  fail: boolean,
  repos: unknown[] = []
) {
  return Layer.succeed(GitHubPipeline, {
    build: () =>
      Ref.update(calls, (n) => n + 1).pipe(
        Effect.zipRight(
          fail
            ? Effect.fail(
                new GitHubRateLimited({
                  message: "API rate limit exceeded.",
                  retryAfterSeconds: null,
                  resetAt: null,
                })
              )
            : Effect.succeed(repos)
        )
      ),
  } as unknown as typeof GitHubPipeline.Service);
}

const repoFlow = (owner: string, repo: string, openPulls: number) => ({
  owner,
  repo,
  openPulls: Array.from({ length: openPulls }, () => ({})),
});

const credential = (id: string): GitHubCredential => ({
  kind: "installation",
  id,
  token: Effect.succeed("token"),
});

describe("PipelineCache", () => {
  test("builds once and serves the cached value", async () => {
    const calls = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const counter = yield* Ref.make(0);
          const layer = PipelineCacheLive.pipe(
            Layer.provide(stubPipeline(counter, false))
          );
          const cache = yield* Effect.provide(PipelineCache, layer);
          yield* cache.get(credential("t"));
          yield* cache.get(credential("t"));
          return yield* Ref.get(counter);
        })
      )
    );
    expect(calls).toBe(1);
  });

  test("serves the cached build when the reported version matches", async () => {
    const calls = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const counter = yield* Ref.make(0);
          const layer = PipelineCacheLive.pipe(
            Layer.provide(
              stubPipeline(counter, false, [repoFlow("useautumn", "autumn", 2)])
            )
          );
          const cache = yield* Effect.provide(PipelineCache, layer);
          yield* cache.get(credential("t"));
          yield* cache.get(credential("t"), "useautumn/autumn:2");
          return yield* Ref.get(counter);
        })
      )
    );
    expect(calls).toBe(1);
  });

  test("serves immediately and refreshes in the background when behind", async () => {
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const counter = yield* Ref.make(0);
          const layer = PipelineCacheLive.pipe(
            Layer.provide(
              stubPipeline(counter, false, [repoFlow("useautumn", "autumn", 2)])
            )
          );
          const cache = yield* Effect.provide(PipelineCache, layer);
          yield* cache.get(credential("t"));
          const duringCall = yield* Ref.get(counter);
          yield* cache.get(credential("t"), "useautumn/autumn:3");
          /**
           * The second read must not have blocked on a rebuild: the build count
           * is unchanged at the moment it returns. The refresh is forked, so it
           * lands afterwards.
           */
          const afterCall = yield* Ref.get(counter);
          yield* Effect.yieldNow();
          return { duringCall, afterCall };
        })
      )
    );
    expect(result.duringCall).toBe(1);
    expect(result.afterCall).toBe(1);
  });

  test("does not rebuild on every request while rate limited", async () => {
    const calls = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const counter = yield* Ref.make(0);
          const layer = PipelineCacheLive.pipe(
            Layer.provide(stubPipeline(counter, true))
          );
          const cache = yield* Effect.provide(PipelineCache, layer);
          yield* Effect.ignore(cache.get(credential("t")));
          yield* Effect.ignore(cache.get(credential("t")));
          yield* Effect.ignore(cache.get(credential("t")));
          return yield* Ref.get(counter);
        })
      )
    );
    expect(calls).toBe(1);
  });
});
