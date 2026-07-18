import {
  type HttpClient,
  HttpClientRequest,
  type HttpClientResponse,
} from "@effect/platform";
import { Unauthorized } from "@sphynx/schema/pull-request-views";
import {
  GitHubRateLimited,
  GitHubUnavailable,
  type PullRequestRef,
} from "@sphynx/schema/pull-requests";
import { Effect } from "effect";
import type { GitHubConfig } from "./config";
import {
  friendlyErrorMessage,
  type GitHubAuthedRestError,
  pullRequestNotFound,
} from "./errors";

export const pullPath = (ref: PullRequestRef, suffix = "") =>
  `/repos/${ref.owner}/${ref.repo}/pulls/${ref.number}${suffix}`;

export const resetAt = (response: HttpClientResponse.HttpClientResponse) => {
  const reset = response.headers["x-ratelimit-reset"];
  if (!reset) {
    return null;
  }
  const seconds = Number(reset);
  return Number.isNaN(seconds) ? null : new Date(seconds * 1000).toISOString();
};

export const retryAfter = (response: HttpClientResponse.HttpClientResponse) => {
  const value = response.headers["retry-after"];
  const seconds = value ? Number(value) : Number.NaN;
  return Number.isNaN(seconds) ? null : seconds;
};

export const isRateLimited = (
  response: HttpClientResponse.HttpClientResponse
) =>
  response.status === 429 ||
  (response.status === 403 &&
    (response.headers["x-ratelimit-remaining"] === "0" ||
      response.headers["retry-after"] !== undefined));

const rejectFailedResponse = (
  response: HttpClientResponse.HttpClientResponse
): Effect.Effect<void, GitHubAuthedRestError> =>
  Effect.gen(function* () {
    if (isRateLimited(response)) {
      return yield* Effect.fail(
        new GitHubRateLimited({
          message: "GitHub rate limit exceeded",
          retryAfterSeconds: retryAfter(response),
          resetAt: resetAt(response),
        })
      );
    }
    if (response.status === 401 || response.status === 403) {
      return yield* Effect.fail(
        new Unauthorized({ message: "GitHub rejected the request" })
      );
    }
    if (response.status === 404) {
      return yield* Effect.fail(pullRequestNotFound());
    }
    if (response.status >= 400) {
      const responseBody = yield* response.json.pipe(
        Effect.orElseSucceed(() => null)
      );
      const message =
        responseBody &&
        typeof responseBody === "object" &&
        "message" in responseBody
          ? friendlyErrorMessage(String(responseBody.message))
          : `GitHub rejected the request with ${response.status}`;
      return yield* Effect.fail(new GitHubUnavailable({ message }));
    }
  });

type RestMethod = "GET" | "POST" | "PUT";

export const makeRest =
  (config: typeof GitHubConfig.Service, client: HttpClient.HttpClient) =>
  (
    token: string,
    method: RestMethod,
    path: string,
    body?: Record<string, unknown>
  ): Effect.Effect<
    HttpClientResponse.HttpClientResponse,
    GitHubAuthedRestError
  > =>
    Effect.gen(function* () {
      const base = HttpClientRequest.make(method)(
        `${config.apiUrl}${path}`
      ).pipe(
        HttpClientRequest.bearerToken(token),
        HttpClientRequest.setHeaders({
          accept: "application/vnd.github+json",
          "x-github-api-version": config.apiVersion,
        })
      );
      const outgoing = body
        ? base.pipe(HttpClientRequest.bodyUnsafeJson(body))
        : base;
      const response = yield* client
        .execute(outgoing)
        .pipe(
          Effect.mapError(
            () => new GitHubUnavailable({ message: "GitHub is unreachable" })
          )
        );
      yield* rejectFailedResponse(response);
      return response;
    }).pipe(
      Effect.timeoutFail({
        duration: config.timeout,
        onTimeout: () =>
          new GitHubUnavailable({ message: "GitHub request timed out" }),
      })
    );
