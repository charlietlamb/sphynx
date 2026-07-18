import type { Pipeline } from "@sphynx/schema/review-queue";
import { Cache, Clock, Context, Duration, Effect, Layer, Ref } from "effect";
import type { GitHubAuthedError } from "./errors";
import { GitHubPipeline } from "./pipeline";

const PIPELINE_TTL = Duration.minutes(10);
const PIPELINE_REFRESH_MS = Duration.toMillis(Duration.seconds(45));
const MARK_RETENTION_MS = Duration.toMillis(PIPELINE_TTL);

export interface PipelineCacheShape {
  readonly drop: (token: string) => Effect.Effect<void>;
  readonly get: (token: string) => Effect.Effect<Pipeline, GitHubAuthedError>;
}

interface TokenState {
  readonly at: number;
  readonly generation: number;
}

const makePipelineCache = Effect.gen(function* () {
  const pipeline = yield* GitHubPipeline;
  const scope = yield* Effect.scope;

  const cache = yield* Cache.make({
    capacity: 64,
    timeToLive: PIPELINE_TTL,
    lookup: (token: string): Effect.Effect<Pipeline, GitHubAuthedError> =>
      pipeline.build(token).pipe(Effect.map((repos) => ({ repos }))),
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

  const get = (token: string) =>
    Effect.gen(function* () {
      const wasCached = yield* cache.contains(token);
      const value = yield* cache
        .get(token)
        .pipe(Effect.tapError(() => cache.invalidate(token)));
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

  const drop = (token: string) =>
    cache.invalidate(token).pipe(
      Effect.zipRight(
        Ref.update(tokenStates, (states) => {
          const next = new Map(states);
          const current = next.get(token);
          next.set(token, {
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
