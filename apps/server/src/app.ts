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
import { ServerConfig, ServerConfigLive } from "./config";
import { GitHubClientLive } from "./github/client";
import { GitHubConfigLive } from "./github/config";
import { GitHubReviewsLive } from "./github/reviews";
import { GitHubViewerLive } from "./github/viewer";
import { PullRequestCommentsApiLive } from "./routes/comments/live";
import { PullRequestsApiLive } from "./routes/pulls/live";
import { PullRequestViewsApiLive } from "./routes/views/live";

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
      const api = yield* Effect.acquireRelease(
        Effect.sync(() => HttpApiBuilder.toWebHandler(ApiLive, { memoMap })),
        ({ dispose }) => Effect.promise(dispose)
      );
      const server = yield* Effect.acquireRelease(
        Effect.sync(() =>
          Bun.serve({
            fetch: (request) =>
              isAuthPath(new URL(request.url).pathname)
                ? auth.handler(request)
                : api.handler(request),
            hostname: config.host,
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

const GitHubLive = Layer.mergeAll(
  GitHubClientLive,
  GitHubViewerLive,
  GitHubReviewsLive
).pipe(Layer.provide(Layer.mergeAll(GitHubConfigLive, FetchHttpClient.layer)));

const DatabaseLiveLayer = DatabaseLive.pipe(Layer.provide(DatabaseConfigLive));
const AuthLiveLayer = AuthLive.pipe(
  Layer.provideMerge(Layer.mergeAll(AuthConfigLive, DatabaseLiveLayer))
);

const ApiLive = Layer.mergeAll(
  HttpApiBuilder.api(SphynxApi).pipe(
    Layer.provide(
      Layer.mergeAll(
        HealthApiLive,
        PullRequestsApiLive,
        PullRequestViewsApiLive,
        PullRequestCommentsApiLive
      )
    )
  ),
  PlatformHttpServer.layerContext
).pipe(Layer.provide(Layer.mergeAll(GitHubLive, AuthLiveLayer)));

export const main = Effect.scoped(
  Effect.gen(function* () {
    const memoMap = yield* Layer.makeMemoMap;
    const scope = yield* Effect.scope;
    const context = yield* Layer.buildWithMemoMap(
      Layer.mergeAll(ServerConfigLive, AuthLiveLayer),
      memoMap,
      scope
    );
    return yield* Layer.launch(httpServerLive(memoMap)).pipe(
      Effect.provide(context)
    );
  })
);
