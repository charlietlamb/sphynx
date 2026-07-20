import { HttpApiBuilder, HttpServerResponse } from "@effect/platform";
import { SphynxApi } from "@sphynx/schema/api";
import { PullRequestSummarySchema } from "@sphynx/schema/pull-requests";
import { INSTALLATION_HEADER } from "@sphynx/schema/review-queue";
import { Effect, type Schema } from "effect";
import { GitHubAuth } from "../auth/github-auth";
import { GitHubClient, type GitHubResult } from "../github/client";

const cacheHeaders = (etag: string | null) => ({
  "cache-control": "private, max-age=0, must-revalidate",
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
      const { readToken } = yield* GitHubAuth;

      /** The client names an installation; a bad value falls back server-side. */
      const requested = (headers: Record<string, string | undefined>) => {
        const raw = headers[INSTALLATION_HEADER];
        const parsed = raw ? Number(raw) : Number.NaN;
        return Number.isInteger(parsed) ? parsed : null;
      };

      const tokenFor = (headers: Record<string, string | undefined>) =>
        readToken(headers.cookie, requested(headers));

      return handlers
        .handleRaw("getPullRequest", ({ path, headers }) =>
          tokenFor(headers).pipe(
            Effect.flatMap((token) =>
              github.getPullRequest(token, path, headers["if-none-match"])
            ),
            Effect.flatMap((result) =>
              response(PullRequestSummarySchema, result)
            )
          )
        )
        .handle("getPullRequestPatches", ({ path, headers }) =>
          tokenFor(headers).pipe(
            Effect.flatMap((token) => github.listAllPatches(token, path))
          )
        )
        .handle("getPullRequestFileContents", ({ path, urlParams, headers }) =>
          tokenFor(headers).pipe(
            Effect.flatMap((token) =>
              github.getFileContents(token, path, urlParams.path, urlParams.sha)
            ),
            Effect.map((content) => ({ content }))
          )
        );
    })
);
