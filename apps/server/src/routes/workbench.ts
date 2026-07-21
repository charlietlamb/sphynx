import { HttpApiBuilder } from "@effect/platform";
import { SphynxApi } from "@sphynx/schema/api";
import { Effect } from "effect";
import { GitHubAuth } from "../auth/github-auth";
import { installationIdFromCredentialId } from "../github/credential";
import { ReadModelReader } from "../github/read-model-reader";
import { ViewerLogin } from "../github/viewer-login";

export const WorkbenchApiLive = HttpApiBuilder.group(
  SphynxApi,
  "workbench",
  (handlers) =>
    Effect.gen(function* () {
      const reader = yield* ReadModelReader;
      const viewers = yield* ViewerLogin;
      const { readCredential } = yield* GitHubAuth;

      /**
       * The feed comes from the read model (webhook-materialized), never a live
       * GitHub call. The viewer login is resolved per credential so the client
       * can mark the user's own actions.
       */
      return handlers.handle("getRepoEvents", ({ path, headers }) =>
        readCredential(headers.cookie).pipe(
          Effect.flatMap((credential) => {
            const installationId = installationIdFromCredentialId(
              credential.id
            );
            if (installationId === null) {
              return Effect.succeed({ events: [], viewer: null });
            }
            return credential.token.pipe(
              Effect.flatMap((token) => viewers.resolve(credential.id, token)),
              Effect.flatMap((viewer) =>
                reader.readWorkbench(
                  installationId,
                  { owner: path.owner, repo: path.repo },
                  viewer
                )
              )
            );
          })
        )
      );
    })
);
