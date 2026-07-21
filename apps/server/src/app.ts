import {
  FetchHttpClient,
  HttpApiBuilder,
  HttpServer as PlatformHttpServer,
} from "@effect/platform";
import { Auth, AuthLive } from "@sphynx/auth";
import { AuthConfigLive } from "@sphynx/auth/config";
import { DatabaseLive } from "@sphynx/db/client";
import { DatabaseConfigLive } from "@sphynx/db/config";
import { SphynxApi } from "@sphynx/schema/api";
import { Context, Effect, Layer } from "effect";
import { GitHubAuthLive } from "./auth/github-auth";
import { ServerConfig, ServerConfigLive } from "./config";
import { GitHubAppAuthLive } from "./github/app-auth";
import { GitHubClientLive } from "./github/client";
import { GitHubConfigLive } from "./github/config";
import { GitHubConversationLive } from "./github/conversation";
import { GitHubPipelineLive } from "./github/pipeline";
import { PipelineCacheLive } from "./github/pipeline-cache";
import { ReadModelWriterLive } from "./github/read-model-writer";
import { GitHubRepoEventsLive } from "./github/repo-events";
import { GitHubReviewQueueLive } from "./github/review-queue";
import { GitHubReviewsLive } from "./github/reviews";
import { SearchCacheLive } from "./github/search-cache";
import { GitHubViewerLive } from "./github/viewer";
import { WebhookIngest, WebhookIngestLive } from "./github/webhook-ingest";
import { PullRequestCommentsApiLive } from "./routes/comments";
import { PullRequestConversationApiLive } from "./routes/conversation";
import { PullRequestsApiLive } from "./routes/pulls";
import { ReviewQueueApiLive } from "./routes/review-queue";
import { PullRequestViewsApiLive } from "./routes/views";
import { handleWebhook, isWebhookPath } from "./routes/webhooks";
import { WorkbenchApiLive } from "./routes/workbench";
import { TracingLive } from "./tracing";

const REQUEST_IDLE_TIMEOUT_SECONDS = 60;

export class HttpServer extends Context.Tag("@sphynx/server/HttpServer")<
  HttpServer,
  Bun.Server<unknown>
>() {}

const httpServerLive = (memoMap: Layer.MemoMap) =>
  Layer.scoped(
    HttpServer,
    Effect.gen(function* () {
      const config = yield* ServerConfig;
      const auth = yield* Auth;
      const ingest = yield* WebhookIngest;
      const api = yield* Effect.acquireRelease(
        Effect.sync(() => HttpApiBuilder.toWebHandler(ApiLive, { memoMap })),
        ({ dispose }) => Effect.promise(dispose)
      );
      const webhook = (request: Request) =>
        Effect.runPromise(
          handleWebhook(request).pipe(
            Effect.provideService(WebhookIngest, ingest),
            Effect.tapErrorCause((cause) =>
              Effect.logError("webhook handler failed", cause)
            ),
            Effect.orElseSucceed(() => new Response("error", { status: 500 }))
          )
        );
      const server = yield* Effect.acquireRelease(
        Effect.sync(() =>
          Bun.serve({
            fetch: (request) => {
              const { pathname } = new URL(request.url);
              if (isWebhookPath(pathname)) {
                return webhook(request);
              }
              return isAuthPath(pathname)
                ? auth.handler(request)
                : api.handler(request);
            },
            hostname: config.host,
            idleTimeout: REQUEST_IDLE_TIMEOUT_SECONDS,
            port: config.port,
          })
        ),
        (server) => Effect.sync(() => server.stop(true))
      );

      yield* Effect.logInfo(
        `server listening on http://${config.host}:${server.port}`
      );
      return server;
    })
  );

const isAuthPath = (pathname: string) =>
  pathname === "/api/auth" || pathname.startsWith("/api/auth/");

const HealthApiLive = HttpApiBuilder.group(SphynxApi, "health", (handlers) =>
  handlers.handle("health", () => Effect.succeed({ ok: true }))
);

const DatabaseLiveLayer = DatabaseLive.pipe(Layer.provide(DatabaseConfigLive));

const GitHubLive = Layer.mergeAll(PipelineCacheLive, SearchCacheLive).pipe(
  Layer.provideMerge(GitHubPipelineLive),
  Layer.provideMerge(
    Layer.mergeAll(
      GitHubClientLive,
      GitHubViewerLive,
      GitHubReviewsLive,
      GitHubReviewQueueLive,
      GitHubRepoEventsLive,
      GitHubConversationLive,
      GitHubAppAuthLive,
      ReadModelWriterLive.pipe(Layer.provide(DatabaseLiveLayer))
    )
  ),
  Layer.provide(Layer.mergeAll(GitHubConfigLive, FetchHttpClient.layer))
);
const AuthLiveLayer = AuthLive.pipe(
  Layer.provideMerge(Layer.mergeAll(AuthConfigLive, DatabaseLiveLayer))
);

const GitHubAuthLiveLayer = GitHubAuthLive.pipe(
  Layer.provide(Layer.mergeAll(GitHubLive, AuthLiveLayer))
);

const ApiLive = Layer.mergeAll(
  HttpApiBuilder.api(SphynxApi).pipe(
    Layer.provide(
      Layer.mergeAll(
        HealthApiLive,
        PullRequestsApiLive,
        PullRequestViewsApiLive,
        PullRequestCommentsApiLive,
        PullRequestConversationApiLive,
        ReviewQueueApiLive,
        WorkbenchApiLive
      )
    )
  ),
  PlatformHttpServer.layerContext
).pipe(
  Layer.provide(
    Layer.mergeAll(
      GitHubLive,
      GitHubConfigLive,
      AuthLiveLayer,
      GitHubAuthLiveLayer
    )
  ),
  Layer.provide(TracingLive)
);

const WebhookIngestLiveLayer = WebhookIngestLive.pipe(
  Layer.provide(Layer.mergeAll(DatabaseLiveLayer, GitHubConfigLive))
);

export const main = Effect.scoped(
  Effect.gen(function* () {
    const memoMap = yield* Layer.makeMemoMap;
    const scope = yield* Effect.scope;
    const context = yield* Layer.buildWithMemoMap(
      Layer.mergeAll(ServerConfigLive, AuthLiveLayer, WebhookIngestLiveLayer),
      memoMap,
      scope
    );
    return yield* Layer.launch(httpServerLive(memoMap)).pipe(
      Effect.provide(context)
    );
  })
);
