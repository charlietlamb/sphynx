import { HttpApiBuilder } from "@effect/platform";
import { Auth } from "@sphynx/auth";
import { Database } from "@sphynx/db/client";
import { SphynxApi } from "@sphynx/schema/api";
import { Unauthorized } from "@sphynx/schema/pull-request-views";
import { Config, Effect, Redacted } from "effect";
import { githubTokenFor } from "../auth/github-token";
import { GitHubConfig } from "../github/config";
import { GitHubRepoEvents } from "../github/repo-events";

export const WorkbenchApiLive = HttpApiBuilder.group(
  SphynxApi,
  "workbench",
  (handlers) =>
    Effect.gen(function* () {
      const events = yield* GitHubRepoEvents;
      const auth = yield* Auth;
      const db = yield* Database;
      const nodeEnv = yield* Config.string("NODE_ENV").pipe(
        Config.withDefault("development")
      );
      const appConfig = yield* GitHubConfig;
      const githubToken = githubTokenFor(
        auth,
        db,
        "Sign in to view repository activity"
      );

      return handlers
        .handle("getRepoEvents", ({ path, headers }) =>
          githubToken(headers.cookie).pipe(
            Effect.flatMap((token) => events.get(path.owner, path.repo, token))
          )
        )
        .handle("getDevRepoEvents", ({ path }) =>
          Effect.gen(function* () {
            const token = appConfig.token;
            if (nodeEnv === "production" || token === undefined) {
              return yield* Effect.fail(
                new Unauthorized({ message: "Not available" })
              );
            }
            return yield* events.get(
              path.owner,
              path.repo,
              Redacted.value(token)
            );
          })
        );
    })
);
