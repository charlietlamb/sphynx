import { HttpApiBuilder, HttpServerResponse } from "@effect/platform";
import { SphynxApi } from "@sphynx/schema/api";
import {
  PullRequestFilesPageSchema,
  PullRequestSummarySchema,
} from "@sphynx/schema/pull-requests";
import { Effect, type Schema } from "effect";
import { GitHubClient, type GitHubResult } from "../../github/client";

const cacheHeaders = (etag: string | null) => ({
  "cache-control": "public, max-age=0, s-maxage=30, must-revalidate",
  ...(etag ? { etag } : {}),
});

const response = <A, I>(
  schema: Schema.Schema<A, I, never>,
  result: GitHubResult<A>
) =>
  result._tag === "NotModified"
    ? Effect.succeed(
        HttpServerResponse.empty({
          status: 304,
          headers: cacheHeaders(result.etag),
        })
      )
    : HttpServerResponse.schemaJson(schema)(result.value, {
        headers: cacheHeaders(result.etag),
      }).pipe(Effect.orDie);

export const PullRequestsApiLive = HttpApiBuilder.group(
  SphynxApi,
  "pullRequests",
  (handlers) =>
    Effect.gen(function* () {
      const github = yield* GitHubClient;
      return handlers
        .handleRaw("getPullRequest", ({ path, headers }) =>
          github
            .getPullRequest(path, headers["if-none-match"])
            .pipe(
              Effect.flatMap((result) =>
                response(PullRequestSummarySchema, result)
              )
            )
        )
        .handleRaw(
          "listPullRequestFiles",
          ({ path, urlParams: { page }, headers }) =>
            github
              .listPullRequestFiles(path, page, headers["if-none-match"])
              .pipe(
                Effect.flatMap((result) =>
                  response(PullRequestFilesPageSchema, result)
                )
              )
        )
        .handle("getPullRequestFileContents", ({ path, urlParams }) =>
          github
            .getFileContents(path, urlParams.path, urlParams.sha)
            .pipe(Effect.map((content) => ({ content })))
        );
    })
);
