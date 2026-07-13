import { Config, Context, Layer } from "effect";
import type { Redacted } from "effect/Redacted";

export interface DatabaseConfigShape {
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
  })
);
