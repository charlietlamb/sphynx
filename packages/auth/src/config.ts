import {
  Config,
  Context,
  Redacted as EffectRedacted,
  Layer,
  Option,
} from "effect";
import type { Redacted } from "effect/Redacted";

const oauthProvider = (prefix: string) =>
  Config.all({
    clientId: Config.string(`${prefix}_CLIENT_ID`),
    clientSecret: Config.redacted(`${prefix}_CLIENT_SECRET`),
  }).pipe(
    Config.option,
    Config.map(
      Option.filter(
        ({ clientId, clientSecret }) =>
          clientId.trim().length > 0 &&
          EffectRedacted.value(clientSecret).trim().length > 0
      )
    )
  );

export interface OAuthProviderCredentials {
  readonly clientId: string;
  readonly clientSecret: Redacted<string>;
}

export interface AuthConfigShape {
  readonly github: OAuthProviderCredentials | undefined;
  readonly secret: Redacted<string>;
  readonly trustedOrigins: readonly string[];
  readonly url: string;
}

export class AuthConfig extends Context.Tag("@sphynx/auth/AuthConfig")<
  AuthConfig,
  AuthConfigShape
>() {}

export const AuthConfigLive = Layer.effect(
  AuthConfig,
  Config.all({
    secret: Config.redacted("BETTER_AUTH_SECRET"),
    url: Config.string("BETTER_AUTH_URL").pipe(
      Config.withDefault("http://127.0.0.1:3003")
    ),
    trustedOrigins: Config.string("AUTH_TRUSTED_ORIGINS").pipe(
      Config.map((value) =>
        value
          .split(",")
          .map((origin) => origin.trim())
          .filter((origin) => origin.length > 0)
      ),
      Config.withDefault<readonly string[]>(["http://localhost:3006"])
    ),
    github: oauthProvider("GITHUB").pipe(Config.map(Option.getOrUndefined)),
  })
);
