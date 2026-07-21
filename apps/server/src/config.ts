import { Config, Context, Layer, type Redacted } from "effect";

export interface ServerConfigShape {
  /** Shared secret the reconcile cron presents; absent disables the endpoint. */
  readonly cronSecret: Redacted.Redacted<string> | null;
  readonly host: string;
  readonly port: number;
}

export class ServerConfig extends Context.Tag("@sphynx/server/ServerConfig")<
  ServerConfig,
  ServerConfigShape
>() {}

export const ServerConfigLive = Layer.effect(
  ServerConfig,
  Config.all({
    host: Config.string("HOST").pipe(Config.withDefault("127.0.0.1")),
    port: Config.integer("PORT").pipe(Config.withDefault(3003)),
    cronSecret: Config.redacted("CRON_SECRET").pipe(
      Config.option,
      Config.map((option) => (option._tag === "Some" ? option.value : null))
    ),
  })
);
