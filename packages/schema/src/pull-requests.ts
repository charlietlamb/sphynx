import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform";
import { Schema } from "effect";

export const GitHubOwnerSchema = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(39),
  Schema.pattern(/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/)
);

export const GitHubRepositorySchema = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(100),
  Schema.pattern(/^[A-Za-z0-9._-]+$/)
);

const PullNumberSchema = Schema.NumberFromString.pipe(
  Schema.int(),
  Schema.positive()
);

export const MAX_FILE_PAGES = 30;

const PageSchema = Schema.NumberFromString.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(1),
  Schema.lessThanOrEqualTo(MAX_FILE_PAGES)
);

export const PullRequestRefSchema = Schema.Struct({
  owner: GitHubOwnerSchema,
  repo: GitHubRepositorySchema,
  number: PullNumberSchema,
});

export type PullRequestRef = typeof PullRequestRefSchema.Type;

export const GitHubUserSchema = Schema.Struct({
  login: Schema.String,
  avatarUrl: Schema.String,
});

export type GitHubUser = typeof GitHubUserSchema.Type;

const GitRefSchema = Schema.Struct({
  ref: Schema.String,
  sha: Schema.String,
});

export const PullRequestSummarySchema = Schema.Struct({
  repository: Schema.Struct({
    id: Schema.Number,
    owner: Schema.String,
    name: Schema.String,
    url: Schema.String,
  }),
  number: Schema.Number,
  title: Schema.String,
  body: Schema.NullOr(Schema.String),
  state: Schema.Literal("open", "closed", "merged"),
  draft: Schema.Boolean,
  author: Schema.NullOr(GitHubUserSchema),
  base: GitRefSchema,
  head: GitRefSchema,
  stats: Schema.Struct({
    commits: Schema.Number,
    changedFiles: Schema.Number,
    additions: Schema.Number,
    deletions: Schema.Number,
    comments: Schema.Number,
    reviewComments: Schema.Number,
  }),
  createdAt: Schema.String,
  updatedAt: Schema.String,
  mergedAt: Schema.NullOr(Schema.String),
  githubUrl: Schema.String,
});

export type PullRequestSummary = typeof PullRequestSummarySchema.Type;

export const PullRequestFileSchema = Schema.Struct({
  path: Schema.String,
  previousPath: Schema.NullOr(Schema.String),
  sha: Schema.String,
  status: Schema.Literal(
    "added",
    "modified",
    "deleted",
    "renamed",
    "copied",
    "unknown"
  ),
  additions: Schema.Number,
  deletions: Schema.Number,
  changes: Schema.Number,
  patch: Schema.NullOr(Schema.String),
  renderability: Schema.Literal("patch", "binary-or-large"),
  githubUrl: Schema.String,
});

export type PullRequestFile = typeof PullRequestFileSchema.Type;

export const PullRequestFilesPageSchema = Schema.Struct({
  page: Schema.Number,
  nextPage: Schema.NullOr(Schema.Number),
  files: Schema.Array(PullRequestFileSchema),
});

export type PullRequestFilesPage = typeof PullRequestFilesPageSchema.Type;

export const PullRequestFileContentsSchema = Schema.Struct({
  content: Schema.NullOr(Schema.String),
});

export type PullRequestFileContents = typeof PullRequestFileContentsSchema.Type;

export class PullRequestNotFound extends Schema.TaggedError<PullRequestNotFound>()(
  "PullRequestNotFound",
  { message: Schema.String }
) {}

export class GitHubRateLimited extends Schema.TaggedError<GitHubRateLimited>()(
  "GitHubRateLimited",
  {
    message: Schema.String,
    retryAfterSeconds: Schema.NullOr(Schema.Number),
    resetAt: Schema.NullOr(Schema.String),
  }
) {}

/**
 * The user is signed in but Sphynx has no GitHub App installation to act
 * through. Distinct from `Unauthorized` so the client can offer the install
 * flow rather than a sign-in prompt.
 */
export class InstallationRequired extends Schema.TaggedError<InstallationRequired>()(
  "InstallationRequired",
  { message: Schema.String }
) {}

export class GitHubUnavailable extends Schema.TaggedError<GitHubUnavailable>()(
  "GitHubUnavailable",
  { message: Schema.String }
) {}

export class GitHubTimeout extends Schema.TaggedError<GitHubTimeout>()(
  "GitHubTimeout",
  { message: Schema.String }
) {}

const requestHeaders = Schema.Struct({
  "if-none-match": Schema.optional(Schema.String),
});

const getPullRequest = HttpApiEndpoint.get(
  "getPullRequest",
  "/api/public/github/repos/:owner/:repo/pulls/:number"
)
  .setPath(PullRequestRefSchema)
  .setHeaders(requestHeaders)
  .addSuccess(PullRequestSummarySchema);

const listPullRequestFiles = HttpApiEndpoint.get(
  "listPullRequestFiles",
  "/api/public/github/repos/:owner/:repo/pulls/:number/files"
)
  .setPath(PullRequestRefSchema)
  .setUrlParams(
    Schema.Struct({
      page: Schema.optionalWith(PageSchema, { default: () => 1 }),
    })
  )
  .setHeaders(requestHeaders)
  .addSuccess(PullRequestFilesPageSchema);

const getPullRequestFileContents = HttpApiEndpoint.get(
  "getPullRequestFileContents",
  "/api/public/github/repos/:owner/:repo/pulls/:number/file-contents"
)
  .setPath(PullRequestRefSchema)
  .setUrlParams(Schema.Struct({ path: Schema.String, sha: Schema.String }))
  .addSuccess(PullRequestFileContentsSchema);

export const PullRequestsApi = HttpApiGroup.make("pullRequests")
  .add(getPullRequest)
  .add(listPullRequestFiles)
  .add(getPullRequestFileContents)
  .addError(PullRequestNotFound, { status: 404 })
  .addError(GitHubRateLimited, { status: 429 })
  .addError(GitHubUnavailable, { status: 502 })
  .addError(GitHubTimeout, { status: 504 });
