import { Config, Context, Layer } from "effect";

export interface ServerConfigShape {
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
  })
);
