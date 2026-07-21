import { Config, Context, Layer } from "effect";
import type { Redacted } from "effect/Redacted";

export interface DatabaseConfigShape {
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
    poolMax: Config.integer("DATABASE_POOL_MAX").pipe(Config.withDefault(20)),
  })
);
