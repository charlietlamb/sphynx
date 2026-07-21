import { Config, Context, Duration, Layer, Redacted } from "effect";

interface GitHubAppCredentials {
  readonly appId: string;
  readonly clientId: string;
  readonly privateKey: Redacted.Redacted<string>;
}

export interface GitHubConfigShape {
  readonly apiUrl: string;
  readonly apiVersion: string;
  readonly app: GitHubAppCredentials;
  readonly timeout: Duration.Duration;
  readonly webhookSecrets: readonly Redacted.Redacted<string>[];
}

export class GitHubConfig extends Context.Tag("@sphynx/server/GitHubConfig")<
  GitHubConfig,
  GitHubConfigShape
>() {}

/**
 * Normalizes a PEM that arrived through an environment variable.
 *
 * Dashboards and .env files commonly store the key with the newlines escaped
 * as the two characters backslash-n. `createSign` needs real newlines, and
 * fails with an opaque error otherwise, so accept either form.
 */
export const pemFrom = (value: string) => value.replace(/\\n/g, "\n").trim();

export const GitHubConfigLive = Layer.effect(
  GitHubConfig,
  Config.all({
    apiUrl: Config.string("GITHUB_API_URL").pipe(
      Config.withDefault("https://api.github.com")
    ),
    apiVersion: Config.string("GITHUB_API_VERSION").pipe(
      Config.withDefault("2022-11-28")
    ),
    timeout: Config.duration("GITHUB_REQUEST_TIMEOUT").pipe(
      Config.withDefault(Duration.seconds(10))
    ),
    webhookSecrets: Config.all([
      Config.string("GITHUB_WEBHOOK_SECRET"),
      Config.string("GITHUB_WEBHOOK_SECRET_PREVIOUS").pipe(
        Config.withDefault("")
      ),
    ]).pipe(
      Config.map((secrets) =>
        secrets.filter((secret) => secret.length > 0).map(Redacted.make)
      )
    ),
    app: Config.all({
      appId: Config.string("GITHUB_APP_ID"),
      clientId: Config.string("GITHUB_APP_CLIENT_ID"),
      privateKey: Config.string("GITHUB_APP_PRIVATE_KEY").pipe(
        Config.map(pemFrom),
        Config.map(Redacted.make)
      ),
    }),
  })
);
