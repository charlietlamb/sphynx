import { HttpApiBuilder } from "@effect/platform";
import { Auth } from "@sphynx/auth";
import { Database } from "@sphynx/db/client";
import { SphynxApi } from "@sphynx/schema/api";
import { Effect } from "effect";
import { GitHubViewer } from "../../github/viewer";
import { githubTokenFor } from "../github-token";

export const PullRequestViewsApiLive = HttpApiBuilder.group(
  SphynxApi,
  "pullRequestViews",
  (handlers) =>
    Effect.gen(function* () {
      const auth = yield* Auth;
      const db = yield* Database;
      const viewer = yield* GitHubViewer;
      const githubToken = githubTokenFor(
        auth,
        db,
        "Sign in to sync viewed files"
      );

      return handlers
        .handle("listViewedFiles", ({ path, headers }) =>
          githubToken(headers.cookie).pipe(
            Effect.flatMap((token) => viewer.listViewedFiles(path, token)),
            Effect.map((files) => ({ files }))
          )
        )
        .handle("setFileViewed", ({ path, headers, payload }) =>
          githubToken(headers.cookie).pipe(
            Effect.flatMap((token) =>
              viewer.setFileViewed(path, payload, token)
            ),
            Effect.map(() => payload)
          )
        )
        .handle("setAllFilesViewed", ({ path, headers, payload }) =>
          githubToken(headers.cookie).pipe(
            Effect.flatMap((token) =>
              viewer.setAllFilesViewed(path, payload.viewed, token)
            ),
            Effect.map(() => payload)
          )
        );
    })
);
