import { describe, expect, test } from "bun:test";
import { GitHubRateLimited } from "@sphynx/schema/pull-requests";
import { Effect, Layer, Ref } from "effect";
import type { GitHubCredential } from "./credential";
import { GitHubPipeline } from "./pipeline";
import { PipelineCache, PipelineCacheLive } from "./pipeline-cache";

function stubPipeline(calls: Ref.Ref<number>, fail: boolean) {
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
            : Effect.succeed([])
        )
      ),
  } as unknown as typeof GitHubPipeline.Service);
}

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
