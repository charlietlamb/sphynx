import { Auth, AuthLive } from "@sphynx/auth";
import { AuthConfigLive } from "@sphynx/auth/config";
import { DatabaseLive } from "@sphynx/db/client";
import { DatabaseConfigLive } from "@sphynx/db/config";
import { Context, Effect, Layer } from "effect";
import { ServerConfig, ServerConfigLive } from "./config";
import { route } from "./routes";

export class HttpServer extends Context.Tag("@sphynx/server/HttpServer")<
  HttpServer,
  Bun.Server<unknown>
>() {}

const HttpServerLive = Layer.scoped(
  HttpServer,
  Effect.gen(function* () {
    const config = yield* ServerConfig;
    const auth = yield* Auth;
    const server = yield* Effect.acquireRelease(
      Effect.sync(() =>
        Bun.serve({
          fetch: (request) => route(request, auth),
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

const DatabaseLiveLayer = DatabaseLive.pipe(Layer.provide(DatabaseConfigLive));
const AuthLiveLayer = AuthLive.pipe(
  Layer.provideMerge(Layer.mergeAll(AuthConfigLive, DatabaseLiveLayer))
);

export const main = Layer.launch(HttpServerLive).pipe(
  Effect.provide(Layer.mergeAll(ServerConfigLive, AuthLiveLayer)),
  Effect.scoped
);
