import { HttpClient, HttpClientResponse } from "@effect/platform";
import { GitHubUnavailable } from "@sphynx/schema/pull-requests";
import type { WorkbenchFeed } from "@sphynx/schema/workbench";
import { Cache, Context, Data, Duration, Effect, Layer, Schema } from "effect";
import { GitHubConfig } from "./config";
import type { GitHubAuthedRestError } from "./errors";
import { makeRest } from "./http";
import { toWorkbenchEvents } from "./workbench-mappers";

const EVENTS_TTL = Duration.seconds(45);
const VIEWER_TTL = Duration.hours(1);
const EVENTS_PER_PAGE = 100;

const RawViewerSchema = Schema.Struct({ login: Schema.String });

class FeedKey extends Data.Class<{
  readonly token: string;
  readonly owner: string;
  readonly repo: string;
}> {}

const makeGitHubRepoEvents = Effect.gen(function* () {
  const config = yield* GitHubConfig;
  const client = yield* HttpClient.HttpClient;
  const rest = makeRest(config, client);

  const viewerCache = yield* Cache.make({
    capacity: 128,
    timeToLive: VIEWER_TTL,
    lookup: (token: string) =>
      rest(token, "GET", "/user").pipe(
        Effect.flatMap((response) =>
          HttpClientResponse.schemaBodyJson(RawViewerSchema)(response)
        ),
        Effect.map((viewer) => viewer.login),
        Effect.orElseSucceed(() => null),
        Effect.withSpan("GitHubRepoEvents.fetchViewer")
      ),
  });

  const fetchFeed = (
    key: FeedKey
  ): Effect.Effect<WorkbenchFeed, GitHubAuthedRestError> =>
    rest(
      key.token,
      "GET",
      `/repos/${key.owner}/${key.repo}/events?per_page=${EVENTS_PER_PAGE}`
    ).pipe(
      Effect.flatMap((response) =>
        HttpClientResponse.schemaBodyJson(Schema.Array(Schema.Unknown))(
          response
        ).pipe(
          Effect.mapError(
            () => new GitHubUnavailable({ message: "Invalid events response" })
          )
        )
      ),
      Effect.zip(viewerCache.get(key.token)),
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
    token: string
  ): Effect.Effect<WorkbenchFeed, GitHubAuthedRestError> => {
    const key = new FeedKey({
      token,
      owner: owner.toLowerCase(),
      repo: repo.toLowerCase(),
    });
    return cache.get(key).pipe(
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
