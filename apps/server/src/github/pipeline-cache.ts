import type { Pipeline } from "@sphynx/schema/review-queue";
import { Cache, Clock, Context, Duration, Effect, Layer, Ref } from "effect";
import type { GitHubAuthedError } from "./errors";
import { GitHubPipeline } from "./pipeline";

const PIPELINE_TTL = Duration.minutes(10);
const PIPELINE_REFRESH_MS = 45_000;
const MARK_RETENTION_MS = Duration.toMillis(PIPELINE_TTL);

export interface PipelineCacheShape {
  readonly drop: (token: string) => Effect.Effect<void>;
  readonly get: (token: string) => Effect.Effect<Pipeline, GitHubAuthedError>;
}

const makePipelineCache = Effect.gen(function* () {
  const pipeline = yield* GitHubPipeline;

  const cache = yield* Cache.make({
    capacity: 64,
    timeToLive: PIPELINE_TTL,
    lookup: (token: string): Effect.Effect<Pipeline, GitHubAuthedError> =>
      pipeline.build(token).pipe(Effect.map((repos) => ({ repos }))),
  });

  const refreshMarks = yield* Ref.make(new Map<string, number>());

  const markStale = (token: string, now: number) =>
    Ref.modify(refreshMarks, (marks) => {
      const last = marks.get(token) ?? 0;
      if (now - last <= PIPELINE_REFRESH_MS) {
        return [false, marks] as const;
      }
      const next = new Map<string, number>();
      for (const [key, at] of marks) {
        if (now - at <= MARK_RETENTION_MS) {
          next.set(key, at);
        }
      }
      next.set(token, now);
      return [true, next] as const;
    });

  const get = (token: string) =>
    Effect.gen(function* () {
      const value = yield* cache
        .get(token)
        .pipe(Effect.tapError(() => cache.invalidate(token)));
      const now = yield* Clock.currentTimeMillis;
      const shouldRefresh = yield* markStale(token, now);
      if (shouldRefresh) {
        yield* Effect.forkDaemon(
          cache.refresh(token).pipe(
            Effect.tapErrorCause((cause) =>
              Effect.logWarning("pipeline refresh failed", cause)
            ),
            Effect.ignore
          )
        );
      }
      return value;
    }).pipe(Effect.withSpan("PipelineCache.get"));

  const drop = (token: string) =>
    cache.invalidate(token).pipe(
      Effect.zipRight(
        Ref.update(refreshMarks, (previous) => {
          const next = new Map(previous);
          next.delete(token);
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

export const PipelineCacheLive = Layer.effect(PipelineCache, makePipelineCache);
