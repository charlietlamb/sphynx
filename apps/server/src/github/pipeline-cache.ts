import type { Pipeline } from "@sphynx/schema/review-queue";
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
        const change = yield* pipeline.changedSince(token, etag);
        if (change._tag === "NotModified") {
          return { _tag: "NotModified" as const };
        }
        const repos = yield* pipeline.build(token);
        return {
          _tag: "Modified" as const,
          value: { repos } satisfies Pipeline,
          etag: change.etag,
        };
      }),
  });

  const get = (credential: GitHubCredential) =>
    cache
      .get(credential)
      .pipe(
        Effect.withSpan("PipelineCache.get"),
        Effect.annotateLogs({ "github.credential": credential.id })
      );

  const drop = (credential: GitHubCredential) =>
    cache.invalidate(credential).pipe(Effect.withSpan("PipelineCache.drop"));

  return { drop, get } satisfies PipelineCacheShape;
});

export class PipelineCache extends Context.Tag("@sphynx/github/PipelineCache")<
  PipelineCache,
  PipelineCacheShape
>() {}

export const PipelineCacheLive = Layer.scoped(PipelineCache, makePipelineCache);
