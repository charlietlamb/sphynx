import {
  Config,
  Context,
  Duration,
  Layer,
  Option,
  type Redacted,
} from "effect";

export interface GitHubConfigShape {
  readonly apiUrl: string;
  readonly apiVersion: string;
  readonly timeout: Duration.Duration;
  readonly token: Redacted.Redacted<string> | undefined;
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
    token: Config.redacted("GITHUB_API_TOKEN").pipe(
      Config.option,
      Config.map(Option.getOrUndefined)
    ),
  })
);
