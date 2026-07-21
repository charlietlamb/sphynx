import { Config, Context, Layer } from "effect";
import type { Redacted } from "effect/Redacted";

export interface DatabaseConfigShape {
  /**
   * The connection for LISTEN/NOTIFY. Defaults to `url`, but a pooler (Neon's
   * PgBouncer endpoint) silently drops LISTEN/NOTIFY, so in that setup point
   * `LISTEN_DATABASE_URL` at the direct (non-pooled) endpoint while queries keep
   * using the pooled `url`.
   */
  readonly listenUrl: Redacted<string>;
  readonly poolMax: number;
  readonly url: Redacted<string>;
}

export class DatabaseConfig extends Context.Tag("@sphynx/db/DatabaseConfig")<
  DatabaseConfig,
  DatabaseConfigShape
>() {}

export const DatabaseConfigLive = Layer.effect(
  DatabaseConfig,
  Config.all({
    url: Config.redacted("DATABASE_URL"),
    listenUrl: Config.redacted("LISTEN_DATABASE_URL").pipe(
      Config.orElse(() => Config.redacted("DATABASE_URL"))
    ),
    poolMax: Config.integer("DATABASE_POOL_MAX").pipe(Config.withDefault(20)),
  })
);
