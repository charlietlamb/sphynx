import { describe, expect, test } from "bun:test";
import { Effect, Ref, TestClock, TestContext } from "effect";
import { makeRevalidatingCache, type Revalidation } from "./revalidating-cache";

const FRESH_FOR = 30_000;

interface Recorder {
  readonly calls: Ref.Ref<number>;
  readonly etags: Ref.Ref<(string | null)[]>;
}

const modified = (
  value: string,
  etag: string | null
): Revalidation<string> => ({
  _tag: "Modified",
  value,
  etag,
});

const notModified: Revalidation<string> = { _tag: "NotModified" };

const cacheOf = (
  recorder: Recorder,
  respond: (attempt: number, etag: string | null) => Revalidation<string>
) =>
  makeRevalidatingCache<string, string, never, never>({
    freshFor: FRESH_FOR,
    keyId: (key) => key,
    lookup: (_key, etag) =>
      Ref.updateAndGet(recorder.calls, (n) => n + 1).pipe(
        Effect.tap(() => Ref.update(recorder.etags, (all) => [...all, etag])),
        Effect.map((attempt) => respond(attempt, etag))
      ),
  });

const recorder = Effect.all({
  calls: Ref.make(0),
  etags: Ref.make<(string | null)[]>([]),
});

describe("makeRevalidatingCache", () => {
  test("fetches once, then serves from cache while fresh", async () => {
    const calls = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const rec = yield* recorder;
          const cache = yield* cacheOf(rec, () => modified("v1", '"a"'));
          expect(yield* cache.get("k")).toBe("v1");
          expect(yield* cache.get("k")).toBe("v1");
          return yield* Ref.get(rec.calls);
        })
      ).pipe(Effect.provide(TestContext.TestContext))
    );
    expect(calls).toBe(1);
  });

  test("serves stale immediately and revalidates in the background", async () => {
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const rec = yield* recorder;
          const cache = yield* cacheOf(rec, (attempt) =>
            attempt === 1 ? modified("v1", '"a"') : modified("v2", '"b"')
          );
          yield* cache.get("k");
          yield* TestClock.adjust(FRESH_FOR + 1);

          const served = yield* cache.get("k");
          const during = yield* Ref.get(rec.calls);
          yield* TestClock.adjust(1);
          const after = yield* cache.get("k");
          return { served, during, after };
        })
      ).pipe(Effect.provide(TestContext.TestContext))
    );

    expect(result.served).toBe("v1");
    expect(result.during).toBe(1);
    expect(result.after).toBe("v2");
  });

  test("sends the stored etag when revalidating", async () => {
    const etags = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const rec = yield* recorder;
          const cache = yield* cacheOf(rec, () => modified("v1", '"a"'));
          yield* cache.get("k");
          yield* TestClock.adjust(FRESH_FOR + 1);
          yield* cache.get("k");
          yield* TestClock.adjust(1);
          return yield* Ref.get(rec.etags);
        })
      ).pipe(Effect.provide(TestContext.TestContext))
    );
    expect(etags).toEqual([null, '"a"']);
  });

  test("keeps the cached value when revalidation reports NotModified", async () => {
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const rec = yield* recorder;
          const cache = yield* cacheOf(rec, (attempt) =>
            attempt === 1 ? modified("v1", '"a"') : notModified
          );
          yield* cache.get("k");
          yield* TestClock.adjust(FRESH_FOR + 1);
          yield* cache.get("k");
          yield* TestClock.adjust(1);

          const calls = yield* Ref.get(rec.calls);
          const value = yield* cache.get("k");
          return { calls, value };
        })
      ).pipe(Effect.provide(TestContext.TestContext))
    );

    expect(result.value).toBe("v1");
    expect(result.calls).toBe(2);
  });

  test("a 304 extends freshness so it does not revalidate every read", async () => {
    const calls = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const rec = yield* recorder;
          const cache = yield* cacheOf(rec, (attempt) =>
            attempt === 1 ? modified("v1", '"a"') : notModified
          );
          yield* cache.get("k");
          yield* TestClock.adjust(FRESH_FOR + 1);
          yield* cache.get("k");
          yield* TestClock.adjust(1);
          yield* cache.get("k");
          yield* cache.get("k");
          return yield* Ref.get(rec.calls);
        })
      ).pipe(Effect.provide(TestContext.TestContext))
    );
    expect(calls).toBe(2);
  });

  test("collapses concurrent revalidations of the same key", async () => {
    const calls = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const rec = yield* recorder;
          const cache = yield* cacheOf(rec, () => modified("v1", '"a"'));
          yield* cache.get("k");
          yield* TestClock.adjust(FRESH_FOR + 1);
          yield* Effect.all([cache.get("k"), cache.get("k"), cache.get("k")], {
            concurrency: "unbounded",
          });
          yield* TestClock.adjust(1);
          return yield* Ref.get(rec.calls);
        })
      ).pipe(Effect.provide(TestContext.TestContext))
    );
    expect(calls).toBe(2);
  });

  test("collapses concurrent loads of a cold key", async () => {
    const calls = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const rec = yield* recorder;
          /**
           * The lookup yields before returning, as any real HTTP call does. A
           * lookup that completes synchronously would hide a stampede here.
           */
          const cache = yield* makeRevalidatingCache<
            string,
            string,
            never,
            never
          >({
            freshFor: FRESH_FOR,
            keyId: (key) => key,
            lookup: () =>
              Ref.update(rec.calls, (n) => n + 1).pipe(
                Effect.zipRight(Effect.yieldNow()),
                Effect.as(modified("v1", '"a"'))
              ),
          });
          const values = yield* Effect.all(
            [cache.get("k"), cache.get("k"), cache.get("k")],
            { concurrency: "unbounded" }
          );
          expect(values).toEqual(["v1", "v1", "v1"]);
          return yield* Ref.get(rec.calls);
        })
      ).pipe(Effect.provide(TestContext.TestContext))
    );
    expect(calls).toBe(1);
  });

  test("a failed revalidation keeps serving the cached value", async () => {
    const value = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const rec = yield* recorder;
          const cache = yield* makeRevalidatingCache<
            string,
            string,
            string,
            never
          >({
            freshFor: FRESH_FOR,
            keyId: (key) => key,
            lookup: (_key, etag) =>
              Ref.updateAndGet(rec.calls, (n) => n + 1).pipe(
                Effect.tap(() =>
                  Ref.update(rec.etags, (all) => [...all, etag])
                ),
                Effect.flatMap((attempt) =>
                  attempt === 1
                    ? Effect.succeed(modified("v1", '"a"'))
                    : Effect.fail("github is down")
                )
              ),
          });
          yield* cache.get("k");
          yield* TestClock.adjust(FRESH_FOR + 1);
          yield* cache.get("k");
          yield* TestClock.adjust(1);
          return yield* cache.get("k");
        })
      ).pipe(Effect.provide(TestContext.TestContext))
    );
    expect(value).toBe("v1");
  });

  test("invalidate forces the next read to refetch", async () => {
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const rec = yield* recorder;
          const cache = yield* cacheOf(rec, (attempt) =>
            attempt === 1 ? modified("v1", '"a"') : modified("v2", '"b"')
          );
          yield* cache.get("k");
          yield* cache.invalidate("k");
          const value = yield* cache.get("k");
          return { value, calls: yield* Ref.get(rec.calls) };
        })
      ).pipe(Effect.provide(TestContext.TestContext))
    );
    expect(result.value).toBe("v2");
    expect(result.calls).toBe(2);
  });
});
