import type { SearchResults } from "@sphynx/schema/review-queue";
import { Cache, Context, Data, Duration, Effect, Layer, Ref } from "effect";
import type { GitHubCredential } from "./credential";
import type { GitHubAuthedError } from "./errors";
import { GitHubReviewQueue } from "./review-queue";

const SEARCH_TTL = Duration.seconds(60);
const SEARCH_CAPACITY = 256;

/**
 * Structural key rather than a joined string. Search queries contain spaces
 * (`repo:o/r is:pr terms`), so a string key had to be parsed back out and
 * would mis-key on any separator appearing in a field.
 */
class SearchKey extends Data.Class<{
  readonly credentialId: string;
  readonly limit: number;
  readonly query: string;
}> {}

export interface SearchCacheShape {
  readonly get: (
    query: string,
    limit: number,
    credential: GitHubCredential
  ) => Effect.Effect<SearchResults, GitHubAuthedError>;
}

const makeSearchCache = Effect.gen(function* () {
  const queue = yield* GitHubReviewQueue;

  const credentials = yield* Ref.make(new Map<string, GitHubCredential>());

  const cache = yield* Cache.make({
    capacity: SEARCH_CAPACITY,
    timeToLive: SEARCH_TTL,
    lookup: (key: SearchKey): Effect.Effect<SearchResults, GitHubAuthedError> =>
      Ref.get(credentials).pipe(
        Effect.flatMap((live) => {
          const credential = live.get(key.credentialId);
          return credential
            ? credential.token
            : Effect.dieMessage(
                `no credential registered for ${key.credentialId}`
              );
        }),
        Effect.flatMap((token) =>
          queue.searchPulls(key.query, key.limit, token)
        )
      ),
  });

  /**
   * Register the latest credential in place, bounded to the same capacity as the
   * result cache. Copy-on-write here was O(n) per request and the map grew one
   * entry per credential ever seen — an unbounded leak on an always-on process.
   */
  const remember = (credential: GitHubCredential) =>
    Ref.update(credentials, (live) => {
      if (!live.has(credential.id) && live.size >= SEARCH_CAPACITY) {
        const oldest = live.keys().next().value;
        if (oldest !== undefined) {
          live.delete(oldest);
        }
      }
      live.set(credential.id, credential);
      return live;
    });

  return {
    get: (query: string, limit: number, credential: GitHubCredential) => {
      const key = new SearchKey({
        credentialId: credential.id,
        limit,
        query,
      });
      return remember(credential).pipe(
        Effect.zipRight(cache.get(key)),
        Effect.tapError(() => cache.invalidate(key)),
        Effect.withSpan("SearchCache.get")
      );
    },
  } satisfies SearchCacheShape;
});

export class SearchCache extends Context.Tag("@sphynx/github/SearchCache")<
  SearchCache,
  SearchCacheShape
>() {}

export const SearchCacheLive = Layer.scoped(SearchCache, makeSearchCache);
