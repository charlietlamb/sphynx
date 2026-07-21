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
import { Context, Effect, Layer, type Schema } from "effect";
import { GitHubConfig } from "./config";
import { RetryableGitHubError, retryPolicy } from "./errors";
import { refAnnotations } from "./graphql";
import { isRateLimited, pullPath, resetAt, retryAfter } from "./http";
import {
  RawFileContentsSchema,
  type RawPullRequest,
  RawPullRequestFilesSchema,
  RawPullRequestSchema,
  type RawReviewComment,
  RawReviewCommentsSchema,
} from "./rest-schemas";
import { groupReviewThreads } from "./review-threads";
import { buildSymbolIndex } from "./symbol-index";

const MAX_COMMENT_PAGES = 5;

const fileContentOf = (
  value: typeof RawFileContentsSchema.Type
): string | null =>
  "content" in value && typeof value.content === "string"
    ? value.content
    : null;

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

const linkUrlPattern = /<([^>]+)>/;

const encodeFilePath = (path: string) =>
  path.split("/").map(encodeURIComponent).join("/");

const pageFrom = (link: string | undefined, rel: string) => {
  const target = link
    ?.split(",")
    .find((part) => part.includes(`rel="${rel}"`))
    ?.match(linkUrlPattern)?.[1];
  if (!target) {
    return null;
  }
  const page = Number(new URL(target).searchParams.get("page"));
  return Number.isInteger(page) ? page : null;
};

const nextPageFrom = (link: string | undefined) => pageFrom(link, "next");
const lastPageFrom = (link: string | undefined) => pageFrom(link, "last");

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

/**
 * `renderability` is derived from patch presence here, before the patch text
 * is dropped from the file list. Computing it later would report every file as
 * unrenderable.
 */
const toFile = (
  ref: PullRequestRef,
  file: (typeof RawPullRequestFilesSchema.Type)[number]
): PullRequestFile => ({
  path: file.filename,
  previousPath: file.previous_filename ?? null,
  sha: file.sha,
  status: normalizeStatus(file.status),
  additions: file.additions,
  deletions: file.deletions,
  changes: file.changes,
  renderability: file.patch ? "patch" : "binary-or-large",
  githubUrl:
    file.blob_url ??
    `https://github.com/${ref.owner}/${ref.repo}/pull/${ref.number}/files`,
});

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

  /**
   * Every read carries a credential. GitHub only exempts conditional requests
   * from the rate limit when they are authorized, and anonymous reads are
   * capped at 60/hour per IP, so an unauthenticated path is never correct here.
   */
  const request = <A, I>(
    token: string,
    path: string,
    schema: Schema.Schema<A, I, never>,
    ifNoneMatch?: string
  ): Effect.Effect<GitHubResult<A>, GitHubError> => {
    const attempt = Effect.gen(function* () {
      const outgoing = HttpClientRequest.get(`${config.apiUrl}${path}`).pipe(
        HttpClientRequest.setHeaders({
          accept: "application/vnd.github+json",
          authorization: `Bearer ${token}`,
          "x-github-api-version": config.apiVersion,
          ...(ifNoneMatch ? { "if-none-match": ifNoneMatch } : {}),
        })
      );

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

  const getPullRequest = (
    token: string,
    ref: PullRequestRef,
    ifNoneMatch?: string
  ) =>
    request(token, pullPath(ref), RawPullRequestSchema, ifNoneMatch).pipe(
      Effect.map((result) =>
        result._tag === "Modified"
          ? { ...result, value: normalizePullRequest(result.value) }
          : result
      ),
      Effect.withSpan("GitHubClient.getPullRequest"),
      Effect.annotateLogs(refAnnotations(ref))
    );

  const listPullRequestFiles = (
    token: string,
    ref: PullRequestRef,
    page: number,
    ifNoneMatch?: string
  ) =>
    request(
      token,
      pullPath(ref, `/files?per_page=100&page=${page}`),
      RawPullRequestFilesSchema,
      ifNoneMatch
    ).pipe(
      Effect.map((result): GitHubResult<PullRequestFilesPage> => {
        if (result._tag === "NotModified") {
          return result;
        }
        const files: readonly PullRequestFile[] = result.value.map((file) =>
          toFile(ref, file)
        );
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

  type FilesPage = typeof RawPullRequestFilesSchema.Type;

  const filesPage = (token: string, ref: PullRequestRef, page: number) =>
    request(
      token,
      pullPath(ref, `/files?per_page=100&page=${page}`),
      RawPullRequestFilesSchema
    );

  /** Pages 2..last fetched concurrently, once page 1 reveals the total. */
  const parallelRest = (token: string, ref: PullRequestRef, last: number) =>
    Effect.forEach(
      Array.from(
        { length: Math.min(last, MAX_FILE_PAGES) - 1 },
        (_, i) => i + 2
      ),
      (page) => filesPage(token, ref, page),
      { concurrency: 6 }
    ).pipe(
      Effect.map((results) =>
        results.flatMap((r) => (r._tag === "Modified" ? [r.value] : []))
      )
    );

  /** Serial `rel="next"` walk, for when GitHub omits `rel="last"`. */
  const serialRest = (
    token: string,
    ref: PullRequestRef,
    from: number | null
  ) =>
    Effect.gen(function* () {
      const pages: FilesPage[] = [];
      let next = from;
      while (next !== null && next <= MAX_FILE_PAGES) {
        const result = yield* filesPage(token, ref, next);
        if (result._tag === "NotModified") {
          break;
        }
        pages.push(result.value);
        next = nextPageFrom(result.link ?? undefined);
      }
      return pages;
    });

  const assemblePatches = (
    ref: PullRequestRef,
    pages: readonly FilesPage[]
  ) => {
    const patches = new Map<string, string>();
    const files: PullRequestFile[] = [];
    for (const page of pages) {
      for (const file of page) {
        if (file.patch) {
          patches.set(file.filename, file.patch);
        }
        files.push(toFile(ref, file));
      }
    }
    return { files, patches };
  };

  /**
   * Fetch every file page. Page 1 reveals the total via its `rel="last"` link,
   * so the remaining pages are fetched concurrently rather than walked one at a
   * time — a large PR that used to cost N serial round-trips now costs roughly
   * one. Falls back to a serial `rel="next"` walk when GitHub omits `rel="last"`.
   */
  const collectPatches = (token: string, ref: PullRequestRef) =>
    Effect.gen(function* () {
      const first = yield* filesPage(token, ref, 1);
      if (first._tag === "NotModified") {
        return assemblePatches(ref, []);
      }
      const last = lastPageFrom(first.link ?? undefined);
      const rest =
        last === null
          ? yield* serialRest(token, ref, nextPageFrom(first.link ?? undefined))
          : yield* parallelRest(token, ref, last);
      return assemblePatches(ref, [first.value, ...rest]);
    });

  const listAllPatches = (token: string, ref: PullRequestRef) =>
    collectPatches(token, ref).pipe(
      Effect.map(({ files, patches }) => ({
        files,
        patches: Object.fromEntries(patches),
        symbols: buildSymbolIndex(patches),
      })),
      Effect.withSpan("GitHubClient.listAllPatches"),
      Effect.annotateLogs(refAnnotations(ref))
    );

  const listReviewThreads = (token: string, ref: PullRequestRef) =>
    Effect.gen(function* () {
      const comments: RawReviewComment[] = [];
      let page: number | null = 1;
      while (page !== null && page <= MAX_COMMENT_PAGES) {
        const result: GitHubResult<typeof RawReviewCommentsSchema.Type> =
          yield* request(
            token,
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

  const getFileContents = (
    token: string,
    ref: PullRequestRef,
    path: string,
    sha: string
  ) =>
    request(
      token,
      `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/contents/${encodeFilePath(path)}?ref=${encodeURIComponent(sha)}`,
      RawFileContentsSchema
    ).pipe(
      Effect.map((result) => {
        if (result._tag !== "Modified") {
          return null;
        }
        const content = fileContentOf(result.value);
        return content ? Buffer.from(content, "base64").toString("utf8") : null;
      }),
      Effect.catchTag("PullRequestNotFound", () => Effect.succeed(null)),
      Effect.withSpan("GitHubClient.getFileContents"),
      Effect.annotateLogs({ ...refAnnotations(ref), "github.path": path })
    );

  return {
    getPullRequest,
    listPullRequestFiles,
    listAllPatches,
    listReviewThreads,
    getFileContents,
  } as const;
});

export class GitHubClient extends Context.Tag("@sphynx/server/GitHubClient")<
  GitHubClient,
  Effect.Effect.Success<typeof makeClient>
>() {}

export const GitHubClientLive = Layer.effect(GitHubClient, makeClient);
