import { describe, expect, test } from "bun:test";
import { Effect, Layer, Ref } from "effect";
import type { GitHubCredential } from "./credential";
import { GitHubReviewQueue } from "./review-queue";
import { SearchCache, SearchCacheLive } from "./search-cache";

const results = { pulls: [], totalCount: 0 };

function stubQueue(seen: Ref.Ref<{ query: string; limit: number }[]>) {
  return Layer.succeed(GitHubReviewQueue, {
    searchPulls: (query: string, limit: number) =>
      Ref.update(seen, (all) => [...all, { query, limit }]).pipe(
        Effect.as(results)
      ),
  } as unknown as typeof GitHubReviewQueue.Service);
}

const credential = (id: string): GitHubCredential => ({
  kind: "installation",
  id,
  token: Effect.succeed("token"),
});

const run = <E>(
  program: (
    seen: Ref.Ref<{ query: string; limit: number }[]>
  ) => Effect.Effect<void, E, SearchCache>
) =>
  Effect.gen(function* () {
    const seen = yield* Ref.make<{ query: string; limit: number }[]>([]);
    yield* program(seen).pipe(
      Effect.orDie,
      Effect.provide(SearchCacheLive.pipe(Layer.provide(stubQueue(seen))))
    );
    return yield* Ref.get(seen);
  }).pipe(Effect.runPromise);

describe("SearchCache", () => {
  test("serves a repeated query from cache", async () => {
    const seen = await run((_s) =>
      Effect.gen(function* () {
        const cache = yield* SearchCache;
        yield* cache.get("is:pr fix", 30, credential("t"));
        yield* cache.get("is:pr fix", 30, credential("t"));
      })
    );
    expect(seen).toHaveLength(1);
  });

  test("queries containing spaces round-trip intact", async () => {
    const seen = await run((_s) =>
      Effect.gen(function* () {
        const cache = yield* SearchCache;
        yield* cache.get("repo:o/r is:pr some terms", 30, credential("t"));
      })
    );
    expect(seen[0]?.query).toBe("repo:o/r is:pr some terms");
    expect(seen[0]?.limit).toBe(30);
  });

  test("does not confuse queries that differ only by field boundary", async () => {
    const seen = await run((_s) =>
      Effect.gen(function* () {
        const cache = yield* SearchCache;
        yield* cache.get("a b", 30, credential("t"));
        yield* cache.get("a", 30, credential("t b"));
      })
    );
    expect(seen).toHaveLength(2);
  });

  test("separate credentials do not share results", async () => {
    const seen = await run((_s) =>
      Effect.gen(function* () {
        const cache = yield* SearchCache;
        yield* cache.get("is:pr", 30, credential("one"));
        yield* cache.get("is:pr", 30, credential("two"));
      })
    );
    expect(seen).toHaveLength(2);
  });
});
