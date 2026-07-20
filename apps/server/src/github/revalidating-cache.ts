import { Clock, Deferred, Effect, Ref, type Scope } from "effect";

/**
 * A cached value together with the ETag GitHub returned with it.
 *
 * `freshUntil` is advisory: past it the entry is served immediately and
 * revalidated in the background, never inline. Because an authorized conditional
 * request that returns 304 costs no rate limit, revalidation is close to free
 * and can happen far more often than a full refetch.
 */
interface Entry<A> {
  readonly etag: string | null;
  readonly freshUntil: number;
  readonly value: A;
}

/** What a lookup returns: either new data, or confirmation nothing changed. */
export type Revalidation<A> =
  | {
      readonly _tag: "Modified";
      readonly value: A;
      readonly etag: string | null;
    }
  | { readonly _tag: "NotModified" };

export interface RevalidatingCacheOptions<K, A, E, R> {
  /** How long an entry is served without triggering a background revalidate. */
  readonly freshFor: number;
  /** Serializes the key for the underlying map. */
  readonly keyId: (key: K) => string;
  /**
   * Fetches the value, sending `If-None-Match` when an ETag is known. Returning
   * `NotModified` must mean "the cached value is still correct" — never map a
   * 304 to empty data, which would silently discard it.
   */
  readonly lookup: (
    key: K,
    etag: string | null
  ) => Effect.Effect<Revalidation<A>, E, R>;
}

export interface RevalidatingCache<K, A, E> {
  /**
   * Serves the cached value when one exists, revalidating in the background
   * once it is past `freshFor`. Only a cold key waits on GitHub.
   */
  readonly get: (key: K) => Effect.Effect<A, E>;
  /** Drops an entry so the next read refetches. Use after a write. */
  readonly invalidate: (key: K) => Effect.Effect<void>;
}

/**
 * Stale-while-revalidate over GitHub's conditional requests.
 *
 * Failures are never stored: a transient 500 must not pin an error for the
 * lifetime of the entry, which is what `Effect.cachedInvalidateWithTTL` would
 * do. A failed revalidation leaves the existing value in place and is logged.
 */
export const makeRevalidatingCache = <K, A, E, R>(
  options: RevalidatingCacheOptions<K, A, E, R>
): Effect.Effect<RevalidatingCache<K, A, E>, never, R | Scope.Scope> =>
  Effect.gen(function* () {
    const entries = yield* Ref.make(new Map<string, Entry<A>>());
    const inFlight = yield* Ref.make(new Set<string>());
    const context = yield* Effect.context<R>();
    const scope = yield* Effect.scope;
    /**
     * Guards cold loads so simultaneous first readers of a key share one fetch
     * rather than each starting their own.
     */
    const loading = yield* Ref.make(new Map<string, Effect.Effect<void, E>>());

    const store = (id: string, value: A, etag: string | null, now: number) =>
      Ref.update(entries, (current) =>
        new Map(current).set(id, {
          value,
          etag,
          freshUntil: now + options.freshFor,
        })
      );

    const touch = (id: string, now: number) =>
      Ref.update(entries, (current) => {
        const existing = current.get(id);
        if (!existing) {
          return current;
        }
        return new Map(current).set(id, {
          ...existing,
          freshUntil: now + options.freshFor,
        });
      });

    const fetchInto = (key: K, id: string, etag: string | null) =>
      Effect.gen(function* () {
        const result = yield* options.lookup(key, etag);
        const now = yield* Clock.currentTimeMillis;
        if (result._tag === "NotModified") {
          yield* touch(id, now);
          return;
        }
        yield* store(id, result.value, result.etag, now);
      }).pipe(Effect.provide(context));

    /**
     * At most one revalidation per key is in flight. Without this, a burst of
     * requests against a stale entry would each fork their own rebuild.
     */
    const revalidate = (key: K, id: string, etag: string | null) =>
      Ref.modify(inFlight, (running) =>
        running.has(id)
          ? ([false, running] as const)
          : ([true, new Set(running).add(id)] as const)
      ).pipe(
        Effect.flatMap((claimed) =>
          claimed
            ? fetchInto(key, id, etag).pipe(
                Effect.tapErrorCause((cause) =>
                  Effect.logWarning("revalidation failed", cause)
                ),
                Effect.ignore,
                Effect.ensuring(
                  Ref.update(inFlight, (running) => {
                    const next = new Set(running);
                    next.delete(id);
                    return next;
                  })
                ),
                Effect.forkIn(scope),
                Effect.asVoid
              )
            : Effect.void
        )
      );

    /**
     * One fetch per cold key. The first caller installs a deferred effect that
     * later callers await, so a burst on an empty key costs one GitHub request.
     */
    const loadOnce = (key: K, id: string) =>
      Effect.gen(function* () {
        const pending = (yield* Ref.get(loading)).get(id);
        if (pending) {
          return yield* pending;
        }
        const deferred = yield* Deferred.make<void, E>();
        const claimed = yield* Ref.modify(loading, (current) =>
          current.has(id)
            ? ([current.get(id), current] as const)
            : ([
                undefined,
                new Map(current).set(id, Deferred.await(deferred)),
              ] as const)
        );
        if (claimed) {
          return yield* claimed;
        }
        const outcome = yield* fetchInto(key, id, null).pipe(Effect.exit);
        yield* Ref.update(loading, (current) => {
          const next = new Map(current);
          next.delete(id);
          return next;
        });
        yield* Deferred.complete(deferred, outcome);
        return yield* outcome;
      });

    const get = (key: K): Effect.Effect<A, E> =>
      Effect.gen(function* () {
        const id = options.keyId(key);
        const existing = (yield* Ref.get(entries)).get(id);
        if (!existing) {
          yield* loadOnce(key, id);
          const loaded = (yield* Ref.get(entries)).get(id);
          if (!loaded) {
            return yield* Effect.dieMessage(`lookup did not populate ${id}`);
          }
          return loaded.value;
        }
        const now = yield* Clock.currentTimeMillis;
        if (now >= existing.freshUntil) {
          yield* revalidate(key, id, existing.etag);
        }
        return existing.value;
      });

    const invalidate = (key: K) =>
      Ref.update(entries, (current) => {
        const next = new Map(current);
        next.delete(options.keyId(key));
        return next;
      });

    return { get, invalidate };
  });
