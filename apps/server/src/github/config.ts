import { Config, Context, Duration, Layer, type Redacted } from "effect";

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
}

export class GitHubConfig extends Context.Tag("@sphynx/server/GitHubConfig")<
  GitHubConfig,
  GitHubConfigShape
>() {}

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
    app: Config.all({
      appId: Config.string("GITHUB_APP_ID"),
      clientId: Config.string("GITHUB_APP_CLIENT_ID"),
      privateKey: Config.redacted("GITHUB_APP_PRIVATE_KEY"),
    }),
  })
);
