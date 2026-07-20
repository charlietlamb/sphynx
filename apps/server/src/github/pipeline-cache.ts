import type { Pipeline } from "@sphynx/schema/review-queue";
import { Cache, Clock, Context, Duration, Effect, Layer, Ref } from "effect";
import type { GitHubCredential } from "./credential";
import { type GitHubAuthedError, isRateLimited } from "./errors";
import { GitHubPipeline } from "./pipeline";
import { fingerprint } from "./pipeline-fingerprint";

const PIPELINE_TTL = Duration.minutes(10);
const PIPELINE_REFRESH_MS = Duration.toMillis(Duration.minutes(2));
const MARK_RETENTION_MS = Duration.toMillis(PIPELINE_TTL);

export interface PipelineCacheShape {
  readonly drop: (credential: GitHubCredential) => Effect.Effect<void>;
  readonly get: (
    credential: GitHubCredential,
    since?: string
  ) => Effect.Effect<Pipeline, GitHubAuthedError>;
}

interface TokenState {
  readonly at: number;
  readonly generation: number;
}

const RATE_LIMIT_BACKOFF_MS = Duration.toMillis(Duration.minutes(5));

const makePipelineCache = Effect.gen(function* () {
  const pipeline = yield* GitHubPipeline;
  const scope = yield* Effect.scope;

  /**
   * Cache entries are keyed by credential id, which is stable across token
   * rotation. The live credential is held here so the lookup can resolve a
   * fresh token at build time.
   */
  const credentials = yield* Ref.make(new Map<string, GitHubCredential>());

  /**
   * Fingerprint of the data each cached build was made from, so a caller
   * reporting a newer one can be told the entry is behind.
   */
  const builtVersions = yield* Ref.make(new Map<string, string>());

  const cache = yield* Cache.make({
    capacity: 64,
    timeToLive: PIPELINE_TTL,
    lookup: (key: string): Effect.Effect<Pipeline, GitHubAuthedError> =>
      Ref.get(credentials).pipe(
        Effect.flatMap((live) => {
          const credential = live.get(key);
          return credential
            ? credential.token
            : Effect.dieMessage(`no credential registered for ${key}`);
        }),
        Effect.flatMap(pipeline.build),
        Effect.tap((repos) =>
          Ref.update(builtVersions, (versions) =>
            new Map(versions).set(
              key,
              fingerprint(
                repos.map((repo) => ({
                  owner: repo.owner,
                  repo: repo.repo,
                  openPulls: repo.openPulls.length,
                }))
              )
            )
          )
        ),
        Effect.map((repos) => ({ repos }))
      ),
  });

  const tokenStates = yield* Ref.make(new Map<string, TokenState>());

  const pruned = (states: Map<string, TokenState>, now: number) => {
    const next = new Map<string, TokenState>();
    for (const [key, state] of states) {
      if (now - state.at <= MARK_RETENTION_MS) {
        next.set(key, state);
      }
    }
    return next;
  };

  const seedMark = (token: string, now: number) =>
    Ref.update(tokenStates, (states) => {
      const next = pruned(states, now);
      next.set(token, {
        at: now,
        generation: states.get(token)?.generation ?? 0,
      });
      return next;
    });

  const markStale = (token: string, now: number) =>
    Ref.modify(tokenStates, (states) => {
      const current = states.get(token) ?? { at: 0, generation: 0 };
      if (now - current.at <= PIPELINE_REFRESH_MS) {
        return [false, states] as const;
      }
      const next = pruned(states, now);
      next.set(token, { at: now, generation: current.generation });
      return [true, next] as const;
    });

  const generationOf = (token: string) =>
    Ref.get(tokenStates).pipe(
      Effect.map((states) => states.get(token)?.generation ?? 0)
    );

  const refreshInBackground = (token: string) =>
    Effect.gen(function* () {
      const generation = yield* generationOf(token);
      yield* cache.refresh(token).pipe(
        Effect.tapError((error) =>
          isRateLimited(error)
            ? Ref.update(tokenStates, (states) => {
                const next = new Map(states);
                const current = next.get(token);
                next.set(token, {
                  at: (current?.at ?? 0) + RATE_LIMIT_BACKOFF_MS,
                  generation: current?.generation ?? 0,
                });
                return next;
              })
            : Effect.void
        ),
        Effect.tapErrorCause((cause) =>
          Effect.logWarning("pipeline refresh failed", cause)
        ),
        Effect.ignore
      );
      const after = yield* generationOf(token);
      if (after !== generation) {
        yield* cache.invalidate(token);
      }
    }).pipe(Effect.forkIn(scope));

  const get = (credential: GitHubCredential, since?: string) =>
    Effect.gen(function* () {
      const token = credential.id;
      yield* Ref.update(credentials, (live) =>
        new Map(live).set(credential.id, credential)
      );
      /**
       * The caller has seen a fingerprint the cached build predates, so serving
       * it would knowingly return stale data. Drop the entry and rebuild inline.
       */
      if (since !== undefined) {
        const built = yield* Ref.get(builtVersions);
        if (built.get(token) !== since) {
          yield* cache.invalidate(token);
        }
      }
      const wasCached = yield* cache.contains(token);
      const value = yield* cache
        .get(token)
        .pipe(
          Effect.tapError((error) =>
            isRateLimited(error) ? Effect.void : cache.invalidate(token)
          )
        );
      const now = yield* Clock.currentTimeMillis;
      if (wasCached) {
        const shouldRefresh = yield* markStale(token, now);
        if (shouldRefresh) {
          yield* refreshInBackground(token);
        }
      } else {
        yield* seedMark(token, now);
      }
      return value;
    }).pipe(Effect.withSpan("PipelineCache.get"));

  const drop = (credential: GitHubCredential) =>
    cache.invalidate(credential.id).pipe(
      Effect.zipRight(
        Ref.update(tokenStates, (states) => {
          const next = new Map(states);
          const current = next.get(credential.id);
          next.set(credential.id, {
            at: 0,
            generation: (current?.generation ?? 0) + 1,
          });
          return next;
        })
      ),
      Effect.withSpan("PipelineCache.drop")
    );

  return { drop, get } satisfies PipelineCacheShape;
});

export class PipelineCache extends Context.Tag("@sphynx/github/PipelineCache")<
  PipelineCache,
  PipelineCacheShape
>() {}

export const PipelineCacheLive = Layer.scoped(PipelineCache, makePipelineCache);
