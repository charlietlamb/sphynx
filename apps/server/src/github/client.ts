import {
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "@effect/platform";
import {
  GitHubRateLimited,
  GitHubTimeout,
  GitHubUnavailable,
  MAX_FILE_PAGES,
  type PullRequestFile,
  type PullRequestFilesPage,
  PullRequestNotFound,
  type PullRequestRef,
  type PullRequestSummary,
} from "@sphynx/schema/pull-requests";
import {
  Context,
  Data,
  Effect,
  Layer,
  Redacted,
  Schedule,
  type Schema,
} from "effect";
import { GitHubConfig } from "./config";
import { refAnnotations } from "./graphql";
import { groupReviewThreads } from "./review-threads";
import {
  RawFileContentsSchema,
  type RawPullRequest,
  RawPullRequestFilesSchema,
  RawPullRequestSchema,
  type RawReviewComment,
  RawReviewCommentsSchema,
} from "./schemas";

type GitHubError =
  | PullRequestNotFound
  | GitHubRateLimited
  | GitHubUnavailable
  | GitHubTimeout;

export type GitHubResult<A> =
  | {
      readonly _tag: "Modified";
      readonly value: A;
      readonly etag: string | null;
      readonly link: string | null;
    }
  | { readonly _tag: "NotModified"; readonly etag: string | null };

class RetryableGitHubError extends Data.TaggedError("RetryableGitHubError")<{
  readonly message: string;
}> {}

const retryPolicy = Schedule.exponential("100 millis").pipe(Schedule.jittered);
const linkUrlPattern = /<([^>]+)>/;

export const pullPath = (ref: PullRequestRef, suffix = "") =>
  `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/pulls/${ref.number}${suffix}`;

const encodeFilePath = (path: string) =>
  path.split("/").map(encodeURIComponent).join("/");

export const resetAt = (response: HttpClientResponse.HttpClientResponse) => {
  const value = response.headers["x-ratelimit-reset"];
  if (!value) {
    return null;
  }
  const seconds = Number(value);
  return Number.isFinite(seconds)
    ? new Date(seconds * 1000).toISOString()
    : null;
};

export const retryAfter = (response: HttpClientResponse.HttpClientResponse) => {
  const value = Number(response.headers["retry-after"]);
  return Number.isFinite(value) ? value : null;
};

export const isRateLimited = (
  response: HttpClientResponse.HttpClientResponse
) =>
  response.status === 429 ||
  (response.status === 403 &&
    (response.headers["x-ratelimit-remaining"] === "0" ||
      response.headers["retry-after"] !== undefined));

const nextPageFrom = (link: string | undefined) => {
  const next = link
    ?.split(",")
    .find((part) => part.includes('rel="next"'))
    ?.match(linkUrlPattern)?.[1];
  if (!next) {
    return null;
  }
  const page = Number(new URL(next).searchParams.get("page"));
  return Number.isInteger(page) ? page : null;
};

const pullRequestState = (
  pull: RawPullRequest
): PullRequestSummary["state"] => {
  if (pull.merged_at) {
    return "merged";
  }
  return pull.state === "open" ? "open" : "closed";
};

const normalizePullRequest = (pull: RawPullRequest): PullRequestSummary => ({
  repository: {
    id: pull.base.repo.id,
    owner: pull.base.repo.owner.login,
    name: pull.base.repo.name,
    url: pull.base.repo.html_url,
  },
  number: pull.number,
  title: pull.title,
  body: pull.body,
  state: pullRequestState(pull),
  draft: pull.draft,
  author: pull.user
    ? { login: pull.user.login, avatarUrl: pull.user.avatar_url }
    : null,
  base: { ref: pull.base.ref, sha: pull.base.sha },
  head: { ref: pull.head.ref, sha: pull.head.sha },
  stats: {
    commits: pull.commits,
    changedFiles: pull.changed_files,
    additions: pull.additions,
    deletions: pull.deletions,
    comments: pull.comments,
    reviewComments: pull.review_comments,
  },
  createdAt: pull.created_at,
  updatedAt: pull.updated_at,
  mergedAt: pull.merged_at,
  githubUrl: pull.html_url,
});

const normalizeStatus = (status: string): PullRequestFile["status"] => {
  if (status === "removed") {
    return "deleted";
  }
  if (
    status === "added" ||
    status === "modified" ||
    status === "renamed" ||
    status === "copied"
  ) {
    return status;
  }
  return "unknown";
};

const responseError = (
  response: HttpClientResponse.HttpClientResponse
): GitHubError | RetryableGitHubError | null => {
  if (response.status === 404) {
    return new PullRequestNotFound({ message: "Pull request not found" });
  }
  if (isRateLimited(response)) {
    return new GitHubRateLimited({
      message: "GitHub rate limit exceeded",
      retryAfterSeconds: retryAfter(response),
      resetAt: resetAt(response),
    });
  }
  if (response.status >= 500) {
    return new RetryableGitHubError({
      message: `GitHub returned ${response.status}`,
    });
  }
  return response.status === 200
    ? null
    : new GitHubUnavailable({
        message: `GitHub rejected the request with ${response.status}`,
      });
};

const makeClient = Effect.gen(function* () {
  const config = yield* GitHubConfig;
  const http = yield* HttpClient.HttpClient;

  const request = <A, I>(
    path: string,
    schema: Schema.Schema<A, I, never>,
    ifNoneMatch?: string
  ): Effect.Effect<GitHubResult<A>, GitHubError> => {
    const attempt = Effect.gen(function* () {
      let outgoing = HttpClientRequest.get(`${config.apiUrl}${path}`).pipe(
        HttpClientRequest.setHeaders({
          accept: "application/vnd.github+json",
          "x-github-api-version": config.apiVersion,
          ...(ifNoneMatch ? { "if-none-match": ifNoneMatch } : {}),
        })
      );
      if (config.token) {
        outgoing = outgoing.pipe(
          HttpClientRequest.bearerToken(Redacted.value(config.token))
        );
      }

      const response = yield* http
        .execute(outgoing)
        .pipe(
          Effect.mapError(
            () => new RetryableGitHubError({ message: "GitHub request failed" })
          )
        );
      const etag = response.headers.etag ?? null;

      if (response.status === 304) {
        return { _tag: "NotModified" as const, etag };
      }
      const error = responseError(response);
      if (error) {
        return yield* error;
      }

      const value = yield* HttpClientResponse.schemaBodyJson(schema)(
        response
      ).pipe(
        Effect.mapError(
          () => new GitHubUnavailable({ message: "Invalid GitHub response" })
        )
      );
      return {
        _tag: "Modified" as const,
        value,
        etag,
        link: response.headers.link ?? null,
      };
    });

    return attempt.pipe(
      Effect.retry({
        schedule: retryPolicy,
        times: 2,
        while: (error) => error._tag === "RetryableGitHubError",
      }),
      Effect.mapError((error) =>
        error._tag === "RetryableGitHubError"
          ? new GitHubUnavailable({ message: error.message })
          : error
      ),
      Effect.timeoutFail({
        duration: config.timeout,
        onTimeout: () =>
          new GitHubTimeout({ message: "GitHub request timed out" }),
      })
    );
  };

  const getPullRequest = (ref: PullRequestRef, ifNoneMatch?: string) =>
    request(pullPath(ref), RawPullRequestSchema, ifNoneMatch).pipe(
      Effect.map((result) =>
        result._tag === "Modified"
          ? { ...result, value: normalizePullRequest(result.value) }
          : result
      ),
      Effect.withSpan("GitHubClient.getPullRequest"),
      Effect.annotateLogs(refAnnotations(ref))
    );

  const listPullRequestFiles = (
    ref: PullRequestRef,
    page: number,
    ifNoneMatch?: string
  ) =>
    request(
      pullPath(ref, `/files?per_page=100&page=${page}`),
      RawPullRequestFilesSchema,
      ifNoneMatch
    ).pipe(
      Effect.map((result): GitHubResult<PullRequestFilesPage> => {
        if (result._tag === "NotModified") {
          return result;
        }
        const files: readonly PullRequestFile[] = result.value.map((file) => ({
          path: file.filename,
          previousPath: file.previous_filename ?? null,
          sha: file.sha,
          status: normalizeStatus(file.status),
          additions: file.additions,
          deletions: file.deletions,
          changes: file.changes,
          patch: file.patch ?? null,
          renderability: file.patch ? "patch" : "binary-or-large",
          githubUrl: file.blob_url,
        }));
        return {
          _tag: "Modified",
          etag: result.etag,
          link: result.link,
          value: {
            page,
            nextPage:
              page < MAX_FILE_PAGES
                ? nextPageFrom(result.link ?? undefined)
                : null,
            files,
          },
        };
      }),
      Effect.withSpan("GitHubClient.listPullRequestFiles"),
      Effect.annotateLogs({ ...refAnnotations(ref), "github.page": page })
    );

  const listReviewThreads = (ref: PullRequestRef) =>
    Effect.gen(function* () {
      const comments: RawReviewComment[] = [];
      let page: number | null = 1;
      while (page !== null && page <= 5) {
        const result: GitHubResult<typeof RawReviewCommentsSchema.Type> =
          yield* request(
            pullPath(ref, `/comments?per_page=100&page=${page}`),
            RawReviewCommentsSchema
          );
        if (result._tag === "NotModified") {
          break;
        }
        comments.push(...result.value);
        page = nextPageFrom(result.link ?? undefined);
      }
      return groupReviewThreads(comments);
    }).pipe(
      Effect.withSpan("GitHubClient.listReviewThreads"),
      Effect.annotateLogs(refAnnotations(ref))
    );

  const getFileContents = (ref: PullRequestRef, path: string, sha: string) =>
    request(
      `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/contents/${encodeFilePath(path)}?ref=${encodeURIComponent(sha)}`,
      RawFileContentsSchema
    ).pipe(
      Effect.map((result) =>
        result._tag === "Modified" && result.value.content
          ? Buffer.from(result.value.content, "base64").toString("utf8")
          : null
      ),
      Effect.catchTag("PullRequestNotFound", () => Effect.succeed(null)),
      Effect.withSpan("GitHubClient.getFileContents"),
      Effect.annotateLogs({ ...refAnnotations(ref), "github.path": path })
    );

  return {
    getPullRequest,
    listPullRequestFiles,
    listReviewThreads,
    getFileContents,
  } as const;
});

export class GitHubClient extends Context.Tag("@sphynx/server/GitHubClient")<
  GitHubClient,
  Effect.Effect.Success<typeof makeClient>
>() {}

export const GitHubClientLive = Layer.effect(GitHubClient, makeClient);
