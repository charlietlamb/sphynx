import { HttpApiBuilder } from "@effect/platform";
import { SphynxApi } from "@sphynx/schema/api";
import { Effect } from "effect";
import { GitHubAuth } from "../auth/github-auth";
import { GitHubRepoEvents } from "../github/repo-events";

export const WorkbenchApiLive = HttpApiBuilder.group(
  SphynxApi,
  "workbench",
  (handlers) =>
    Effect.gen(function* () {
      const events = yield* GitHubRepoEvents;
      const { readCredential } = yield* GitHubAuth;

      return handlers.handle("getRepoEvents", ({ path, headers }) =>
        readCredential(headers.cookie).pipe(
          Effect.flatMap((credential) =>
            credential.token.pipe(
              Effect.flatMap((token) =>
                events.get(path.owner, path.repo, credential.id, token)
              )
            )
          )
        )
      );
    })
);
