import { Effect, Schema } from "effect";
import {
  GitHubRateLimited,
  GitHubTimeout,
  GitHubUnavailable,
  type GitHubError,
  honorRateLimit,
  pullRequestNotFound,
  RetryableGitHubError,
  retryPolicy,
  Unauthorized,
} from "./githubErrors";

export interface GitHubConfig {
  readonly apiUrl: string;
  readonly apiVersion: string;
  readonly timeoutMillis: number;
}

/**
 * Reads GitHub connection config from the environment, mirroring the server's
 * `GitHubConfigLive` defaults. Available in a Convex `"use node"` action via
 * `process.env`.
 */
export const configFromEnv = (): GitHubConfig => ({
  apiUrl: process.env.GITHUB_API_URL ?? "https://api.github.com",
  apiVersion: process.env.GITHUB_API_VERSION ?? "2022-11-28",
  timeoutMillis: Number(process.env.GITHUB_REQUEST_TIMEOUT_MS ?? "10000"),
});

/**
 * A minimal view of a fetch `Response` that the header-parsing helpers below
 * read. Headers are case-insensitive on `fetch`, so a plain lookup by lower-case
 * name is sufficient, matching the Effect HttpClient's normalized `headers`.
 */
interface RawResponse {
  readonly status: number;
  readonly header: (name: string) => string | null;
  readonly json: () => Promise<unknown>;
}

export const resetAt = (response: RawResponse) => {
  const reset = response.header("x-ratelimit-reset");
  if (!reset) {
    return null;
  }
  const seconds = Number(reset);
  return Number.isNaN(seconds) ? null : new Date(seconds * 1000).toISOString();
};

export const retryAfter = (response: RawResponse) => {
  const value = response.header("retry-after");
  const seconds = value ? Number(value) : Number.NaN;
  return Number.isNaN(seconds) ? null : seconds;
};

export const isRateLimited = (response: RawResponse) =>
  response.status === 429 ||
  (response.status === 403 &&
    (response.header("x-ratelimit-remaining") === "0" ||
      response.header("retry-after") !== null));

type RestMethod = "GET" | "POST" | "PUT";

const RATE_LIMIT_MESSAGE = /rate limit/i;

/**
 * A secondary rate limit comes back as HTTP 200 with a body error rather than a
 * 403, so status-based detection misses it. Classifying it as GitHubRateLimited
 * lets `honorRateLimit` back off instead of the reconcile loop hammering GitHub.
 */
const isRateLimitMessage = (message: string) => RATE_LIMIT_MESSAGE.test(message);

const GraphQLErrors = Schema.optional(
  Schema.Array(Schema.Struct({ message: Schema.String })),
);

/**
 * Performs a single fetch with the shared GitHub headers, wrapping the promise
 * in an Effect. A rejected fetch (network failure) becomes a retryable error so
 * the transient policy can retry it; the caller maps it to `GitHubUnavailable`
 * once the retries are exhausted. Returns the `RawResponse` view the header
 * helpers read plus the parsed JSON body accessor.
 */
const doFetch = (
  config: GitHubConfig,
  token: string,
  method: RestMethod,
  path: string,
  init: {
    body?: Record<string, unknown>;
    ifNoneMatch?: string | null;
    authScheme?: "Bearer" | "token";
  } = {},
): Effect.Effect<RawResponse, RetryableGitHubError> =>
  Effect.tryPromise({
    try: async () => {
      const headers: Record<string, string> = {
        accept: "application/vnd.github+json",
        "x-github-api-version": config.apiVersion,
        authorization: `${init.authScheme ?? "Bearer"} ${token}`,
      };
      if (init.ifNoneMatch) {
        headers["if-none-match"] = init.ifNoneMatch;
      }
      if (init.body) {
        headers["content-type"] = "application/json";
      }
      const response = await fetch(`${config.apiUrl}${path}`, {
        method,
        headers,
        body: init.body ? JSON.stringify(init.body) : undefined,
      });
      return {
        status: response.status,
        header: (name: string) => response.headers.get(name),
        json: () => response.json(),
      } satisfies RawResponse;
    },
    catch: () => new RetryableGitHubError({ message: "GitHub request failed" }),
  });

const rejectFailedRest = (
  response: RawResponse,
): Effect.Effect<void, GitHubError | RetryableGitHubError> =>
  Effect.gen(function* () {
    if (isRateLimited(response)) {
      return yield* Effect.fail(
        new GitHubRateLimited({
          message: "GitHub rate limit exceeded",
          retryAfterSeconds: retryAfter(response),
          resetAt: resetAt(response),
        }),
      );
    }
    if (response.status === 401 || response.status === 403) {
      return yield* Effect.fail(
        new Unauthorized({ message: "GitHub rejected the request" }),
      );
    }
    if (response.status === 404) {
      return yield* Effect.fail(pullRequestNotFound());
    }
    if (response.status >= 500) {
      return yield* Effect.fail(
        new RetryableGitHubError({
          message: `GitHub returned ${response.status}`,
        }),
      );
    }
    if (response.status >= 400) {
      const responseBody = yield* Effect.tryPromise({
        try: () => response.json(),
        catch: () => null,
      }).pipe(Effect.orElseSucceed(() => null));
      const message =
        responseBody &&
        typeof responseBody === "object" &&
        "message" in responseBody
          ? String((responseBody as { message: unknown }).message)
          : `GitHub rejected the request with ${response.status}`;
      return yield* Effect.fail(new GitHubUnavailable({ message }));
    }
  });

const rejectFailedGraphql = (
  response: RawResponse,
): Effect.Effect<
  void,
  Unauthorized | RetryableGitHubError | GitHubUnavailable | GitHubRateLimited
> => {
  const status = response.status;
  if (isRateLimited(response)) {
    return Effect.fail(
      new GitHubRateLimited({
        message: "GitHub GraphQL rate limit exceeded",
        retryAfterSeconds: retryAfter(response),
        resetAt: resetAt(response),
      }),
    );
  }
  if (status === 401 || status === 403) {
    return Effect.fail(
      new Unauthorized({ message: "GitHub rejected the request" }),
    );
  }
  if (status >= 500) {
    return Effect.fail(
      new RetryableGitHubError({ message: `GitHub returned ${status}` }),
    );
  }
  if (status >= 400) {
    return Effect.fail(
      new GitHubUnavailable({
        message: `GitHub rejected the request with ${status}`,
      }),
    );
  }
  return Effect.void;
};

const decodeBody = <A, I>(
  response: RawResponse,
  schema: Schema.Schema<A, I, never>,
  onError: string,
): Effect.Effect<A, GitHubUnavailable> =>
  Effect.tryPromise({
    try: () => response.json(),
    catch: () => new GitHubUnavailable({ message: onError }),
  }).pipe(
    Effect.flatMap((body) =>
      Schema.decodeUnknown(schema)(body).pipe(
        Effect.mapError(() => new GitHubUnavailable({ message: onError })),
      ),
    ),
  );

/**
 * The fetch-based GitHub client. Replaces the Effect `HttpClient` +
 * `GitHubConfig` service layer with a plain closure over env-derived config, so
 * the resulting programs need no Convex `ctx` and run in a `"use node"` action.
 * Every read carries a credential: GitHub only exempts conditional requests from
 * the rate limit when authorized, and anonymous reads are capped at 60/hour.
 */
export const makeGitHubClient = (config: GitHubConfig) => {
  /**
   * A REST call returning the raw response, so callers can read status (for
   * 304s) and headers (etag / link) before decoding. Retries transient
   * failures, times out per request, and honors rate-limit backoff between
   * attempts.
   */
  const rest = (
    token: string,
    method: RestMethod,
    path: string,
    body?: Record<string, unknown>,
    ifNoneMatch?: string | null,
  ): Effect.Effect<RawResponse, GitHubError> =>
    doFetch(config, token, method, path, { body, ifNoneMatch }).pipe(
      Effect.flatMap((response) =>
        rejectFailedRest(response).pipe(Effect.as(response)),
      ),
      Effect.retry({
        schedule: retryPolicy,
        times: 2,
        while: (error) => error._tag === "RetryableGitHubError",
      }),
      Effect.mapError((error) =>
        error._tag === "RetryableGitHubError"
          ? new GitHubUnavailable({ message: error.message })
          : error,
      ),
      Effect.timeoutFail({
        duration: config.timeoutMillis,
        onTimeout: () =>
          new GitHubTimeout({ message: "GitHub request timed out" }),
      }),
      honorRateLimit(),
    );

  /**
   * A REST GET whose JSON body is decoded through `schema`. Kept separate from
   * `rest` so the header-reading callers (etag / link walks) can stay on `rest`.
   */
  const restJson = <A, I>(
    token: string,
    path: string,
    schema: Schema.Schema<A, I, never>,
    onError: string,
  ): Effect.Effect<A, GitHubError> =>
    rest(token, "GET", path).pipe(
      Effect.flatMap((response) => decodeBody(response, schema, onError)),
    );

  const query = <A, I>(
    token: string,
    dataSchema: Schema.Schema<A, I, never>,
    document: string,
    variables: Record<string, unknown>,
  ): Effect.Effect<A, GitHubError> =>
    Effect.gen(function* () {
      const response = yield* doFetch(config, token, "POST", "/graphql", {
        body: { query: document, variables },
      }).pipe(
        Effect.mapError(
          () => new GitHubUnavailable({ message: "GitHub is unreachable" }),
        ),
      );
      yield* rejectFailedGraphql(response);
      const envelope = yield* decodeBody(
        response,
        Schema.Struct({
          data: Schema.NullishOr(dataSchema),
          errors: GraphQLErrors,
        }),
        "Invalid GitHub response",
      );
      const firstError = envelope.errors?.[0];
      if (envelope.data === null || envelope.data === undefined) {
        if (firstError && isRateLimitMessage(firstError.message)) {
          return yield* Effect.fail(
            new GitHubRateLimited({
              message: firstError.message,
              retryAfterSeconds: retryAfter(response),
              resetAt: resetAt(response),
            }),
          );
        }
        return yield* Effect.fail(
          new GitHubUnavailable({
            message: firstError ? firstError.message : "Empty GitHub response",
          }),
        );
      }
      if (firstError) {
        yield* Effect.logWarning("GitHub returned partial data").pipe(
          Effect.annotateLogs({ "github.graphql_error": firstError.message }),
        );
      }
      return envelope.data;
    }).pipe(
      Effect.retry({
        schedule: retryPolicy,
        times: 2,
        while: (error) => error._tag === "RetryableGitHubError",
      }),
      Effect.catchTag(
        "RetryableGitHubError",
        (error) => new GitHubUnavailable({ message: error.message }),
      ),
      Effect.timeoutFail({
        duration: config.timeoutMillis,
        onTimeout: () =>
          new GitHubTimeout({ message: "GitHub request timed out" }),
      }),
      honorRateLimit(),
    );

  return { rest, restJson, query } as const;
};

export type GitHubClient = ReturnType<typeof makeGitHubClient>;
