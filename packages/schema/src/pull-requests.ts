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
  renderability: Schema.Literal("patch", "binary-or-large"),
  githubUrl: Schema.String,
});

export type PullRequestFile = typeof PullRequestFileSchema.Type;

/**
 * Where a symbol is defined within the diff. Built server-side from the same
 * patches the file list is derived from, so the client never has to parse
 * every patch to power go-to-definition.
 */
export const SymbolDefinitionSchema = Schema.Struct({
  kind: Schema.Literal("member", "top"),
  lineNumber: Schema.Number,
  path: Schema.String,
  scope: Schema.Literal("file", "global"),
});

export type SymbolDefinition = typeof SymbolDefinitionSchema.Type;

export const SymbolIndexSchema = Schema.Record({
  key: Schema.String,
  value: SymbolDefinitionSchema,
});

export type SymbolIndexPayload = typeof SymbolIndexSchema.Type;

export const PullRequestFilesPageSchema = Schema.Struct({
  page: Schema.Number,
  nextPage: Schema.NullOr(Schema.Number),
  files: Schema.Array(PullRequestFileSchema),
});

export type PullRequestFilesPage = typeof PullRequestFilesPageSchema.Type;

export const PullRequestFileContentsSchema = Schema.Struct({
  content: Schema.NullOr(Schema.String),
});

/**
 * Every patch in the pull request, keyed by path. Split out of the file list so
 * first paint doesn't wait on the diff text, which is ~90% of the payload.
 * Navigation needs all of them synchronously, so this stays one request.
 */
export const PullRequestPatchesSchema = Schema.Struct({
  patches: Schema.Record({ key: Schema.String, value: Schema.String }),
  symbols: SymbolIndexSchema,
});

export type PullRequestPatches = typeof PullRequestPatchesSchema.Type;

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

/** No usable session. Declared here because every API group can raise it. */
export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  "Unauthorized",
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

/**
 * Reads require a session: they run through a GitHub App installation so they
 * draw on its rate limit rather than the anonymous 60/hour per-IP cap.
 */
const requestHeaders = Schema.Struct({
  cookie: Schema.optional(Schema.String),
  "x-sphynx-installation": Schema.optional(Schema.String),
  "if-none-match": Schema.optional(Schema.String),
});

const getPullRequest = HttpApiEndpoint.get(
  "getPullRequest",
  "/api/github/repos/:owner/:repo/pulls/:number"
)
  .setPath(PullRequestRefSchema)
  .setHeaders(requestHeaders)
  .addSuccess(PullRequestSummarySchema);

const listPullRequestFiles = HttpApiEndpoint.get(
  "listPullRequestFiles",
  "/api/github/repos/:owner/:repo/pulls/:number/files"
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
  "/api/github/repos/:owner/:repo/pulls/:number/file-contents"
)
  .setPath(PullRequestRefSchema)
  .setUrlParams(Schema.Struct({ path: Schema.String, sha: Schema.String }))
  .setHeaders(requestHeaders)
  .addSuccess(PullRequestFileContentsSchema);

const getPullRequestPatches = HttpApiEndpoint.get(
  "getPullRequestPatches",
  "/api/github/repos/:owner/:repo/pulls/:number/patches"
)
  .setPath(PullRequestRefSchema)
  .setHeaders(requestHeaders)
  .addSuccess(PullRequestPatchesSchema);

export const PullRequestsApi = HttpApiGroup.make("pullRequests")
  .add(getPullRequest)
  .add(listPullRequestFiles)
  .add(getPullRequestFileContents)
  .add(getPullRequestPatches)
  .addError(Unauthorized, { status: 401 })
  .addError(InstallationRequired, { status: 403 })
  .addError(PullRequestNotFound, { status: 404 })
  .addError(GitHubRateLimited, { status: 429 })
  .addError(GitHubUnavailable, { status: 502 })
  .addError(GitHubTimeout, { status: 504 });
