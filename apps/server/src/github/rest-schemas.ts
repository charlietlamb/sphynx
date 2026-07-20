import { Schema } from "effect";

const RawUserSchema = Schema.Struct({
  login: Schema.String,
  avatar_url: Schema.String,
});

const RawGitRefSchema = Schema.Struct({
  ref: Schema.String,
  sha: Schema.String,
});

export const RawPullRequestSchema = Schema.Struct({
  number: Schema.Number,
  title: Schema.String,
  body: Schema.NullOr(Schema.String),
  state: Schema.String,
  draft: Schema.Boolean,
  user: Schema.NullOr(RawUserSchema),
  base: Schema.Struct({
    ...RawGitRefSchema.fields,
    repo: Schema.Struct({
      id: Schema.Number,
      name: Schema.String,
      html_url: Schema.String,
      owner: Schema.Struct({ login: Schema.String }),
    }),
  }),
  head: RawGitRefSchema,
  commits: Schema.Number,
  changed_files: Schema.Number,
  additions: Schema.Number,
  deletions: Schema.Number,
  comments: Schema.Number,
  review_comments: Schema.Number,
  created_at: Schema.String,
  updated_at: Schema.String,
  merged_at: Schema.NullOr(Schema.String),
  html_url: Schema.String,
});

export type RawPullRequest = typeof RawPullRequestSchema.Type;

export const RawPullRequestFilesSchema = Schema.Array(
  Schema.Struct({
    sha: Schema.String,
    filename: Schema.String,
    previous_filename: Schema.optional(Schema.String),
    status: Schema.String,
    additions: Schema.Number,
    deletions: Schema.Number,
    changes: Schema.Number,
    patch: Schema.optional(Schema.String),
    blob_url: Schema.NullishOr(Schema.String),
  })
);

const RawReviewCommentSchema = Schema.Struct({
  id: Schema.Number,
  body: Schema.String,
  path: Schema.String,
  line: Schema.NullOr(Schema.Number),
  side: Schema.NullOr(Schema.String),
  start_line: Schema.NullishOr(Schema.Number),
  in_reply_to_id: Schema.optional(Schema.Number),
  user: Schema.NullOr(RawUserSchema),
  created_at: Schema.String,
  html_url: Schema.String,
});

export type RawReviewComment = typeof RawReviewCommentSchema.Type;

export const RawReviewCommentsSchema = Schema.Array(RawReviewCommentSchema);

export const RawIssueCommentSchema = Schema.Struct({
  id: Schema.Number,
  body: Schema.NullishOr(Schema.String),
  user: Schema.NullOr(RawUserSchema),
  created_at: Schema.String,
  html_url: Schema.String,
});

export type RawIssueComment = typeof RawIssueCommentSchema.Type;

export const RawFileContentsSchema = Schema.Union(
  Schema.Struct({ content: Schema.optional(Schema.String) }),
  Schema.Array(Schema.Unknown)
);
