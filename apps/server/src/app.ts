import {
  FetchHttpClient,
  HttpApiBuilder,
  HttpServer as PlatformHttpServer,
} from "@effect/platform";
import { Auth, AuthLive } from "@sphynx/auth";
import { AuthConfigLive } from "@sphynx/auth/config";
import { DatabaseLive } from "@sphynx/db/client";
import { DatabaseConfigLive } from "@sphynx/db/config";
import { ListenerLive } from "@sphynx/db/listen";
import { SphynxApi } from "@sphynx/schema/api";
import { Context, Effect, Layer, Runtime } from "effect";
import { type GitHubAuth, GitHubAuthLive } from "./auth/github-auth";
import { ServerConfig, ServerConfigLive } from "./config";
import { GitHubAppAuthLive } from "./github/app-auth";
import { GitHubClientLive } from "./github/client";
import { GitHubConfigLive } from "./github/config";
import { GitHubConversationLive } from "./github/conversation";
import { type EventBus, EventBusLive } from "./github/event-bus";
import { Materializer, MaterializerLive } from "./github/materializer";
import { GitHubPipelineLive } from "./github/pipeline";
import { ReadModelReaderLive } from "./github/read-model-reader";
import { ReadModelWriterLive } from "./github/read-model-writer";
import { GitHubReviewQueueLive } from "./github/review-queue";
import { GitHubReviewsLive } from "./github/reviews";
import { SearchCacheLive } from "./github/search-cache";
import { GitHubViewerLive } from "./github/viewer";
import { ViewerLoginLive } from "./github/viewer-login";
import { type WebhookIngest, WebhookIngestLive } from "./github/webhook-ingest";
import {
  type WebhookProjector,
  WebhookProjectorLive,
} from "./github/webhook-projector";
import { compressed } from "./http/compress";
import { PullRequestCommentsApiLive } from "./routes/comments";
import { PullRequestConversationApiLive } from "./routes/conversation";
import { handleEvents, isEventsPath } from "./routes/events";
import { PullRequestsApiLive } from "./routes/pulls";
import { handleReconcile, isReconcilePath } from "./routes/reconcile";
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
      const streamRuntime = yield* Effect.runtime<
        | WebhookIngest
        | WebhookProjector
        | EventBus
        | GitHubAuth
        | Materializer
        | ServerConfig
      >();
      const api = yield* Effect.acquireRelease(
        Effect.sync(() => HttpApiBuilder.toWebHandler(ApiLive, { memoMap })),
        ({ dispose }) => Effect.promise(dispose)
      );
      const webhook = (request: Request) =>
        Runtime.runPromise(streamRuntime)(
          handleWebhook(request).pipe(
            Effect.tapErrorCause((cause) =>
              Effect.logError("webhook handler failed", cause)
            ),
            Effect.orElseSucceed(() => new Response("error", { status: 500 }))
          )
        );
      const events = (request: Request) =>
        Runtime.runPromise(streamRuntime)(
          handleEvents(request).pipe(
            Effect.tapErrorCause((cause) =>
              Effect.logError("events handler failed", cause)
            ),
            Effect.orElseSucceed(() => new Response("error", { status: 500 }))
          )
        );
      const reconcile = (request: Request) =>
        Runtime.runPromise(streamRuntime)(
          handleReconcile(request).pipe(
            Effect.tapErrorCause((cause) =>
              Effect.logError("reconcile handler failed", cause)
            ),
            Effect.orElseSucceed(() => new Response("error", { status: 500 }))
          )
        );
      const server = yield* Effect.acquireRelease(
        Effect.sync(() =>
          Bun.serve({
            fetch: async (request) => {
              const { pathname } = new URL(request.url);
              if (isWebhookPath(pathname)) {
                return webhook(request);
              }
              if (isEventsPath(pathname)) {
                return events(request);
              }
              if (isReconcilePath(pathname)) {
                return reconcile(request);
              }
              const response = await (isAuthPath(pathname)
                ? auth.handler(request)
                : api.handler(request));
              return compressed(request, response);
            },
            hostname: config.host,
            idleTimeout: REQUEST_IDLE_TIMEOUT_SECONDS,
            port: config.port,
          })
        ),
        (server) => Effect.sync(() => server.stop(true))
      );

      /**
       * Reconcile runs in-process on a 15-min interval. It is cheap now (ETag
       * 304 fast-path, webhook-active installs skipped) and the container is
       * already always-on for LISTEN/SSE, so it adds negligible cost. The
       * protected `/api/github/reconcile` endpoint also allows an on-demand
       * sweep (and a Vercel Cron on Pro plans).
       */
      const materializer = yield* Materializer;
      yield* materializer.startReconcile;

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

const GitHubLive = SearchCacheLive.pipe(
  Layer.provideMerge(GitHubPipelineLive),
  Layer.provideMerge(
    Layer.mergeAll(
      GitHubClientLive,
      GitHubViewerLive,
      GitHubReviewsLive,
      GitHubReviewQueueLive,
      ViewerLoginLive,
      GitHubConversationLive,
      GitHubAppAuthLive,
      ReadModelWriterLive.pipe(Layer.provide(DatabaseLiveLayer)),
      ReadModelReaderLive.pipe(Layer.provide(DatabaseLiveLayer))
    )
  ),
  Layer.provide(Layer.mergeAll(GitHubConfigLive, FetchHttpClient.layer))
);

const MaterializerLiveLayer = MaterializerLive.pipe(
  Layer.provide(
    Layer.mergeAll(
      GitHubLive,
      ReadModelWriterLive.pipe(Layer.provide(DatabaseLiveLayer)),
      DatabaseLiveLayer
    )
  )
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
      GitHubAuthLiveLayer,
      MaterializerLiveLayer
    )
  ),
  Layer.provide(TracingLive)
);

const WebhookIngestLiveLayer = WebhookIngestLive.pipe(
  Layer.provide(Layer.mergeAll(DatabaseLiveLayer, GitHubConfigLive))
);

const WebhookProjectorLiveLayer = WebhookProjectorLive.pipe(
  Layer.provide(
    Layer.mergeAll(
      GitHubLive,
      ReadModelWriterLive.pipe(Layer.provide(DatabaseLiveLayer)),
      ReadModelReaderLive.pipe(Layer.provide(DatabaseLiveLayer)),
      MaterializerLiveLayer
    )
  )
);

const EventBusLiveLayer = EventBusLive.pipe(
  Layer.provide(ListenerLive.pipe(Layer.provide(DatabaseConfigLive)))
);

export const main = Effect.scoped(
  Effect.gen(function* () {
    const memoMap = yield* Layer.makeMemoMap;
    const scope = yield* Effect.scope;
    const context = yield* Layer.buildWithMemoMap(
      Layer.mergeAll(
        ServerConfigLive,
        AuthLiveLayer,
        WebhookIngestLiveLayer,
        WebhookProjectorLiveLayer,
        EventBusLiveLayer,
        GitHubAuthLiveLayer,
        MaterializerLiveLayer
      ),
      memoMap,
      scope
    );
    return yield* Layer.launch(httpServerLive(memoMap)).pipe(
      Effect.provide(context)
    );
  })
);
