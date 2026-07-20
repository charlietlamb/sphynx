import { HttpClient, HttpClientResponse } from "@effect/platform";
import { GitHubUnavailable } from "@sphynx/schema/pull-requests";
import type { WorkbenchFeed } from "@sphynx/schema/workbench";
import {
  Cache,
  Context,
  Data,
  Duration,
  Effect,
  Layer,
  Ref,
  Schema,
} from "effect";
import { GitHubConfig } from "./config";
import type { GitHubAuthedRestError } from "./errors";
import { makeRest } from "./http";
import { toWorkbenchEvents } from "./workbench-mappers";

const EVENTS_TTL = Duration.seconds(45);
const VIEWER_TTL = Duration.hours(1);
const EVENTS_PER_PAGE = 100;

const RawViewerSchema = Schema.Struct({ login: Schema.String });

/**
 * Keyed on the credential id, never the raw token: installation tokens rotate
 * hourly, which would orphan every entry on rotation.
 */
class FeedKey extends Data.Class<{
  readonly credentialId: string;
  readonly owner: string;
  readonly repo: string;
}> {}

const makeGitHubRepoEvents = Effect.gen(function* () {
  const config = yield* GitHubConfig;
  const client = yield* HttpClient.HttpClient;
  const rest = makeRest(config, client);

  const tokens = yield* Ref.make(new Map<string, string>());

  const tokenFor = (credentialId: string) =>
    Ref.get(tokens).pipe(
      Effect.flatMap((live) => {
        const token = live.get(credentialId);
        return token
          ? Effect.succeed(token)
          : Effect.dieMessage(`no token registered for ${credentialId}`);
      })
    );

  /**
   * A failed viewer lookup is not cached. Resolving it to `null` inside the
   * lookup would store that as a success and pin it for the full hour, turning
   * one transient 500 into an hour of missing attribution.
   */
  const viewerCache = yield* Cache.make({
    capacity: 128,
    timeToLive: VIEWER_TTL,
    lookup: (credentialId: string) =>
      tokenFor(credentialId).pipe(
        Effect.flatMap((token) => rest(token, "GET", "/user")),
        Effect.flatMap((response) =>
          HttpClientResponse.schemaBodyJson(RawViewerSchema)(response)
        ),
        Effect.map((viewer) => viewer.login),
        Effect.withSpan("GitHubRepoEvents.fetchViewer")
      ),
  });

  const viewerLogin = (credentialId: string) =>
    viewerCache.get(credentialId).pipe(
      Effect.tapError(() => viewerCache.invalidate(credentialId)),
      Effect.orElseSucceed(() => null)
    );

  const fetchFeed = (
    key: FeedKey
  ): Effect.Effect<WorkbenchFeed, GitHubAuthedRestError> =>
    tokenFor(key.credentialId).pipe(
      Effect.flatMap((token) =>
        rest(
          token,
          "GET",
          `/repos/${key.owner}/${key.repo}/events?per_page=${EVENTS_PER_PAGE}`
        )
      ),
      Effect.flatMap((response) =>
        HttpClientResponse.schemaBodyJson(Schema.Array(Schema.Unknown))(
          response
        ).pipe(
          Effect.mapError(
            () => new GitHubUnavailable({ message: "Invalid events response" })
          )
        )
      ),
      Effect.zip(viewerLogin(key.credentialId)),
      Effect.map(([raw, viewer]) => ({
        events: toWorkbenchEvents(key.owner, key.repo, raw),
        viewer,
      })),
      Effect.withSpan("GitHubRepoEvents.fetchFeed"),
      Effect.annotateLogs({
        "github.owner": key.owner,
        "github.repository": key.repo,
      })
    );

  const cache = yield* Cache.make({
    capacity: 128,
    timeToLive: EVENTS_TTL,
    lookup: fetchFeed,
  });

  const get = (
    owner: string,
    repo: string,
    credentialId: string,
    token: string
  ): Effect.Effect<WorkbenchFeed, GitHubAuthedRestError> => {
    const key = new FeedKey({
      credentialId,
      owner: owner.toLowerCase(),
      repo: repo.toLowerCase(),
    });
    return Ref.update(tokens, (live) =>
      new Map(live).set(credentialId, token)
    ).pipe(
      Effect.zipRight(cache.get(key)),
      Effect.tapError(() => cache.invalidate(key)),
      Effect.withSpan("GitHubRepoEvents.get"),
      Effect.annotateLogs({
        "github.owner": owner,
        "github.repository": repo,
      })
    );
  };

  return { get };
});

export class GitHubRepoEvents extends Context.Tag("@sphynx/github/RepoEvents")<
  GitHubRepoEvents,
  Effect.Effect.Success<typeof makeGitHubRepoEvents>
>() {}

export const GitHubRepoEventsLive = Layer.effect(
  GitHubRepoEvents,
  makeGitHubRepoEvents
);
