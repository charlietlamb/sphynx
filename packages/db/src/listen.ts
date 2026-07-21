import { Context, Effect, Layer, Redacted } from "effect";
import { Client } from "pg";
import { DatabaseConfig } from "./config";

/**
 * A dedicated LISTEN/NOTIFY connection, separate from the query pool.
 *
 * A pooled connection cannot hold a `LISTEN` — the pool hands it back between
 * queries — so notifications need their own long-lived client. This wraps `pg`
 * so the driver stays inside the db package.
 */
export interface ListenConnection {
  readonly listen: (
    channel: string,
    onNotify: (payload: string | null) => void
  ) => Effect.Effect<void>;
}

export class Listener extends Context.Tag("@sphynx/db/Listener")<
  Listener,
  ListenConnection
>() {}

export const ListenerLive = Layer.scoped(
  Listener,
  Effect.gen(function* () {
    const config = yield* DatabaseConfig;
    const client = yield* Effect.acquireRelease(
      Effect.gen(function* () {
        const connection = new Client({
          connectionString: Redacted.value(config.url),
        });
        yield* Effect.tryPromise(() => connection.connect()).pipe(Effect.orDie);
        return connection;
      }),
      (connection) => Effect.promise(() => connection.end()).pipe(Effect.orDie)
    );

    const listen = (
      channel: string,
      onNotify: (payload: string | null) => void
    ) =>
      Effect.gen(function* () {
        client.on("notification", (message) => {
          if (message.channel === channel) {
            onNotify(message.payload ?? null);
          }
        });
        yield* Effect.tryPromise(() => client.query(`LISTEN ${channel}`)).pipe(
          Effect.orDie
        );
      });

    return { listen } satisfies ListenConnection;
  })
);
