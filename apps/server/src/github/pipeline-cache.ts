import type { Pipeline, Queue } from "@sphynx/schema/review-queue";
import { Context, Duration, Effect, Layer } from "effect";
import type { GitHubCredential } from "./credential";
import type { GitHubAuthedError } from "./errors";
import { GitHubPipeline } from "./pipeline";
import { makeRevalidatingCache } from "./revalidating-cache";

/**
 * How long a build is served before the next read triggers a background
 * revalidation. Short, because revalidating is a single conditional request
 * against the repository list rather than a full rebuild.
 */
const FRESH_FOR = Duration.toMillis(Duration.seconds(45));

export interface PipelineCacheShape {
  readonly drop: (credential: GitHubCredential) => Effect.Effect<void>;
  readonly get: (
    credential: GitHubCredential
  ) => Effect.Effect<Pipeline, GitHubAuthedError>;
  /** The queue without the rail, for the dashboard's first paint. */
  readonly queue: (
    credential: GitHubCredential
  ) => Effect.Effect<Queue, GitHubAuthedError>;
}

const makePipelineCache = Effect.gen(function* () {
  const pipeline = yield* GitHubPipeline;

  const cache = yield* makeRevalidatingCache<
    GitHubCredential,
    Pipeline,
    GitHubAuthedError,
    never
  >({
    freshFor: FRESH_FOR,
    keyId: (credential) => credential.id,
    /**
     * The repository listing carries an ETag, so an unchanged installation
     * revalidates for free and the expensive per-repo fan-out is skipped
     * entirely. Only a changed listing pays for a rebuild.
     */
    lookup: (credential, etag) =>
      Effect.gen(function* () {
        const token = yield* credential.token;
        const result = yield* pipeline.refresh(token, etag);
        if (result._tag === "NotModified") {
          return { _tag: "NotModified" as const };
        }
        return {
          _tag: "Modified" as const,
          value: { repos: result.repos } satisfies Pipeline,
          etag: result.etag,
        };
      }),
  });

  const queueCache = yield* makeRevalidatingCache<
    GitHubCredential,
    Queue,
    GitHubAuthedError,
    never
  >({
    freshFor: FRESH_FOR,
    keyId: (credential) => `queue:${credential.id}`,
    lookup: (credential) =>
      credential.token.pipe(
        Effect.flatMap(pipeline.currentQueue),
        Effect.map((repos) => ({
          _tag: "Modified" as const,
          value: { repos } satisfies Queue,
          etag: null,
        }))
      ),
  });

  const queue = (credential: GitHubCredential) =>
    queueCache
      .get(credential)
      .pipe(
        Effect.withSpan("PipelineCache.queue"),
        Effect.annotateLogs({ "github.credential": credential.id })
      );

  const get = (credential: GitHubCredential) =>
    cache
      .get(credential)
      .pipe(
        Effect.withSpan("PipelineCache.get"),
        Effect.annotateLogs({ "github.credential": credential.id })
      );

  const drop = (credential: GitHubCredential) =>
    Effect.all([
      cache.invalidate(credential),
      queueCache.invalidate(credential),
    ]).pipe(Effect.asVoid, Effect.withSpan("PipelineCache.drop"));

  return { drop, get, queue } satisfies PipelineCacheShape;
});

export class PipelineCache extends Context.Tag("@sphynx/github/PipelineCache")<
  PipelineCache,
  PipelineCacheShape
>() {}

export const PipelineCacheLive = Layer.scoped(PipelineCache, makePipelineCache);
