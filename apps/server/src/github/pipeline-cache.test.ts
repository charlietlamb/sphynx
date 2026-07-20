import { describe, expect, test } from "bun:test";
import { Effect, Layer, Ref, TestClock, TestContext } from "effect";
import type { GitHubCredential } from "./credential";
import { GitHubPipeline } from "./pipeline";
import { PipelineCache, PipelineCacheLive } from "./pipeline-cache";

interface Counters {
  /** Refreshes that actually rebuilt, as opposed to reporting NotModified. */
  readonly builds: Ref.Ref<number>;
  readonly checks: Ref.Ref<number>;
}

/**
 * `refresh` does the cheap conditional check and the expensive rebuild as one
 * call, so a rebuild is observable as a Modified result.
 */
function stubPipeline(counters: Counters, options: { changed: boolean }) {
  return Layer.succeed(GitHubPipeline, {
    refresh: (_token: string, etag: string | null) =>
      Ref.updateAndGet(counters.checks, (n) => n + 1).pipe(
        Effect.flatMap(
          (attempt): Effect.Effect<unknown> =>
            options.changed || etag === null
              ? Ref.update(counters.builds, (n) => n + 1).pipe(
                  Effect.as({
                    _tag: "Modified" as const,
                    etag: `etag-${attempt}`,
                    repos: [],
                  })
                )
              : Effect.succeed({ _tag: "NotModified" as const })
        )
      ),
    currentQueue: () => Effect.succeed([]),
  } as unknown as typeof GitHubPipeline.Service);
}

const credential = (id: string): GitHubCredential => ({
  kind: "installation",
  id,
  token: Effect.succeed("token"),
});

/**
 * The layer wraps the program rather than being resolved inside a scope.
 * `Layer.scoped` ties background revalidation fibers to the layer's scope, so a
 * scope that closes early cancels them before they can run.
 */
const run = <E>(
  options: { changed: boolean },
  program: Effect.Effect<void, E, PipelineCache>
) =>
  Effect.gen(function* () {
    const counters: Counters = {
      builds: yield* Ref.make(0),
      checks: yield* Ref.make(0),
    };
    yield* program.pipe(
      Effect.orDie,
      Effect.provide(
        PipelineCacheLive.pipe(Layer.provide(stubPipeline(counters, options)))
      )
    );
    return {
      builds: yield* Ref.get(counters.builds),
      checks: yield* Ref.get(counters.checks),
    };
  }).pipe(Effect.provide(TestContext.TestContext), Effect.runPromise);

describe("PipelineCache", () => {
  test("builds once and serves the cached value", async () => {
    const { builds } = await run(
      { changed: false },
      Effect.gen(function* () {
        const cache = yield* PipelineCache;
        yield* cache.get(credential("t"));
        yield* cache.get(credential("t"));
      })
    );
    expect(builds).toBe(1);
  });

  test("an unchanged installation revalidates without rebuilding", async () => {
    const { builds, checks } = await run(
      { changed: false },
      Effect.gen(function* () {
        const cache = yield* PipelineCache;
        yield* cache.get(credential("t"));
        yield* TestClock.adjust(60_000);
        yield* cache.get(credential("t"));
        yield* TestClock.adjust(1);
      })
    );
    expect(checks).toBe(2);
    expect(builds).toBe(1);
  });

  test("rebuilds once the installation actually changes", async () => {
    const { builds } = await run(
      { changed: true },
      Effect.gen(function* () {
        const cache = yield* PipelineCache;
        yield* cache.get(credential("t"));
        yield* TestClock.adjust(60_000);
        yield* cache.get(credential("t"));
        yield* TestClock.adjust(1);
      })
    );
    expect(builds).toBe(2);
  });

  test("a stale read is served before the rebuild finishes", async () => {
    const { builds } = await run(
      { changed: true },
      Effect.gen(function* () {
        const cache = yield* PipelineCache;
        yield* cache.get(credential("t"));
        yield* TestClock.adjust(60_000);
        yield* cache.get(credential("t"));
      })
    );
    expect(builds).toBe(1);
  });

  test("drop forces the next read to rebuild", async () => {
    const { builds } = await run(
      { changed: false },
      Effect.gen(function* () {
        const cache = yield* PipelineCache;
        yield* cache.get(credential("t"));
        yield* cache.drop(credential("t"));
        yield* cache.get(credential("t"));
      })
    );
    expect(builds).toBe(2);
  });

  test("separate installations do not share a cache entry", async () => {
    const { builds } = await run(
      { changed: false },
      Effect.gen(function* () {
        const cache = yield* PipelineCache;
        yield* cache.get(credential("one"));
        yield* cache.get(credential("two"));
        yield* cache.get(credential("one"));
      })
    );
    expect(builds).toBe(2);
  });
});
