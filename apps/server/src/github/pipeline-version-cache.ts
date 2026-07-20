import type { PipelineVersion } from "@sphynx/schema/review-queue";
import { Cache, Context, Duration, Effect, Layer, Ref } from "effect";
import type { GitHubCredential } from "./credential";
import type { GitHubAuthedError } from "./errors";
import { GitHubPipelineVersion } from "./pipeline-version";

const VERSION_TTL = Duration.seconds(15);
const VERSION_CAPACITY = 256;

export interface PipelineVersionCacheShape {
  readonly get: (
    credential: GitHubCredential
  ) => Effect.Effect<PipelineVersion, GitHubAuthedError>;
}

const makePipelineVersionCache = Effect.gen(function* () {
  const version = yield* GitHubPipelineVersion;

  const credentials = yield* Ref.make(new Map<string, GitHubCredential>());

  const cache = yield* Cache.make({
    capacity: VERSION_CAPACITY,
    timeToLive: VERSION_TTL,
    lookup: (key: string) =>
      Ref.get(credentials).pipe(
        Effect.flatMap((live) => {
          const credential = live.get(key);
          return credential
            ? credential.token
            : Effect.dieMessage(`no credential registered for ${key}`);
        }),
        Effect.flatMap(version.build)
      ),
  });

  return {
    get: (credential: GitHubCredential) =>
      Ref.update(credentials, (live) =>
        new Map(live).set(credential.id, credential)
      ).pipe(Effect.zipRight(cache.get(credential.id))),
  };
});

export class PipelineVersionCache extends Context.Tag(
  "@sphynx/github/PipelineVersionCache"
)<PipelineVersionCache, PipelineVersionCacheShape>() {}

export const PipelineVersionCacheLive = Layer.scoped(
  PipelineVersionCache,
  makePipelineVersionCache
);
