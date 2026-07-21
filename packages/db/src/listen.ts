import {
  Context,
  Duration,
  Effect,
  Fiber,
  Layer,
  Redacted,
  Ref,
  Schedule,
} from "effect";
import { Client } from "pg";
import { DatabaseConfig } from "./config";

/**
 * A dedicated LISTEN/NOTIFY connection, separate from the query pool.
 *
 * A pooled connection cannot hold a `LISTEN` — the pool hands it back between
 * queries — so notifications need their own long-lived client. This wraps `pg`
 * so the driver stays inside the db package.
 *
 * The connection self-heals: `pg.Client` emits `error` on connection loss (a
 * network blip, or Neon suspending an idle compute), which would otherwise be an
 * unhandled exception and crash the process. On loss the client reconnects with
 * backoff and re-issues every registered `LISTEN`, then fires `onReconnect` so
 * subscribers can re-read the state they may have missed during the gap —
 * `pg_notify` only reaches sessions listening at notify time, so anything sent
 * while disconnected is gone.
 */
export interface ListenConnection {
  readonly listen: (
    channel: string,
    onNotify: (payload: string | null) => void
  ) => Effect.Effect<void>;
  readonly onReconnect: (handler: () => void) => Effect.Effect<void>;
}

export class Listener extends Context.Tag("@sphynx/db/Listener")<
  Listener,
  ListenConnection
>() {}

const RETRY = Schedule.exponential(Duration.seconds(1)).pipe(
  Schedule.union(Schedule.spaced(Duration.seconds(30)))
);

export const ListenerLive = Layer.scoped(
  Listener,
  Effect.gen(function* () {
    const config = yield* DatabaseConfig;
    const notifyHandlers = new Map<string, (payload: string | null) => void>();
    const reconnectHandlers = new Set<() => void>();
    const current = yield* Ref.make<Client | null>(null);
    const hasConnected = yield* Ref.make(false);

    const openClient = Effect.gen(function* () {
      const client = new Client({
        connectionString: Redacted.value(config.listenUrl),
      });
      yield* Effect.tryPromise(() => client.connect());
      client.on("notification", (message) => {
        notifyHandlers.get(message.channel)?.(message.payload ?? null);
      });
      for (const channel of notifyHandlers.keys()) {
        yield* Effect.tryPromise(() => client.query(`LISTEN ${channel}`));
      }
      return client;
    });

    /**
     * Own the connection: open one (with backoff), replaying every LISTEN, then
     * wait for it to drop and loop. The reconnect handlers must fire *after* the
     * new connection is listening — not when the old one drops — or the wake
     * they trigger races ahead of the re-LISTEN and misses notifies sent in the
     * reconnect gap. So a successful open that isn't the first fires them here,
     * once the replayed LISTENs are already in place.
     * Supervised so a blip never escapes as an uncaught process error.
     */
    const cycle = Effect.gen(function* () {
      const client = yield* openClient.pipe(Effect.retry(RETRY));
      yield* Ref.set(current, client);
      const reconnected = yield* Ref.getAndSet(hasConnected, true);
      if (reconnected && notifyHandlers.size > 0) {
        for (const handler of reconnectHandlers) {
          handler();
        }
      }
      yield* Effect.async<void>((resume) => {
        client.on("error", () => resume(Effect.void));
        client.on("end", () => resume(Effect.void));
      });
      yield* Ref.set(current, null);
      yield* Effect.sync(() => {
        client.removeAllListeners();
        client.end().catch(() => {
          /* already broken */
        });
      });
    }).pipe(
      Effect.catchAllCause((cause) =>
        Effect.logWarning("listener connection error", cause)
      )
    );

    const fiber = yield* Effect.forkScoped(Effect.forever(cycle));
    yield* Effect.addFinalizer(() => Fiber.interrupt(fiber));

    const listen = (
      channel: string,
      onNotify: (payload: string | null) => void
    ) =>
      Effect.gen(function* () {
        notifyHandlers.set(channel, onNotify);
        const client = yield* Ref.get(current);
        if (client) {
          yield* Effect.tryPromise(() =>
            client.query(`LISTEN ${channel}`)
          ).pipe(
            Effect.catchAllCause((cause) =>
              Effect.logWarning(
                "initial LISTEN failed; will retry on reconnect",
                cause
              )
            )
          );
        }
      });

    const onReconnect = (handler: () => void) =>
      Effect.sync(() => {
        reconnectHandlers.add(handler);
      });

    return { listen, onReconnect } satisfies ListenConnection;
  })
);
