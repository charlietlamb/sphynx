import { Schema } from "effect";

const GitHubOwnerSchema = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(39),
  Schema.pattern(/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/)
);

const GitHubRepositorySchema = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(100),
  Schema.pattern(/^[A-Za-z0-9._-]+$/)
);

const PullNumberSchema = Schema.NumberFromString.pipe(
  Schema.int(),
  Schema.positive()
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

const PullRequestSummarySchema = Schema.Struct({
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

const PullRequestFileSchema = Schema.Struct({
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
const SymbolDefinitionSchema = Schema.Struct({
  kind: Schema.Literal("member", "top"),
  lineNumber: Schema.Number,
  path: Schema.String,
  scope: Schema.Literal("file", "global"),
});

export type SymbolDefinition = typeof SymbolDefinitionSchema.Type;

const SymbolIndexSchema = Schema.Record({
  key: Schema.String,
  value: SymbolDefinitionSchema,
});

export type SymbolIndexPayload = typeof SymbolIndexSchema.Type;

/**
 * Every patch in the pull request, keyed by path. Split out of the file list so
 * first paint doesn't wait on the diff text, which is ~90% of the payload.
 * Navigation needs all of them synchronously, so this stays one request.
 */
const PullRequestPatchesSchema = Schema.Struct({
  /**
   * The file list is returned alongside the patches because both come from the
   * same GitHub pages. Fetching them separately walked those pages twice.
   */
  files: Schema.Array(PullRequestFileSchema),
  patches: Schema.Record({ key: Schema.String, value: Schema.String }),
  symbols: SymbolIndexSchema,
});

export type PullRequestPatches = typeof PullRequestPatchesSchema.Type;
