import { Schema } from "effect";

const CommentSideSchema = Schema.Literal("additions", "deletions");

const ReviewCommentSchema = Schema.Struct({
  id: Schema.String,
  body: Schema.String,
  author: Schema.NullOr(
    Schema.Struct({ login: Schema.String, avatarUrl: Schema.String })
  ),
  createdAt: Schema.String,
  githubUrl: Schema.String,
  pending: Schema.Boolean,
});

export type ReviewComment = typeof ReviewCommentSchema.Type;

const ReviewThreadSchema = Schema.Struct({
  id: Schema.NullOr(Schema.String),
  path: Schema.String,
  line: Schema.Number,
  side: CommentSideSchema,
  startLine: Schema.NullOr(Schema.Number),
  isResolved: Schema.Boolean,
  isOutdated: Schema.Boolean,
  viewerCanResolve: Schema.Boolean,
  comments: Schema.Array(ReviewCommentSchema),
});

export type ReviewThread = typeof ReviewThreadSchema.Type;

const CreateReviewCommentSchema = Schema.Struct({
  body: Schema.String.pipe(Schema.minLength(1)),
  commitSha: Schema.String,
  path: Schema.String,
  line: Schema.Number,
  side: CommentSideSchema,
  startLine: Schema.NullOr(Schema.Number),
  pending: Schema.Boolean,
});

export type CreateReviewComment = typeof CreateReviewCommentSchema.Type;

const ReplyPayloadSchema = Schema.Struct({
  body: Schema.String.pipe(Schema.minLength(1)),
  commentId: Schema.String,
});

export type ReplyPayload = typeof ReplyPayloadSchema.Type;

const ResolveThreadSchema = Schema.Struct({
  threadId: Schema.String,
  resolved: Schema.Boolean,
});

export type ResolveThread = typeof ResolveThreadSchema.Type;

const PendingReviewSchema = Schema.Struct({
  pendingId: Schema.NullOr(Schema.String),
  commentCount: Schema.Number,
});

export type PendingReview = typeof PendingReviewSchema.Type;

const ReviewEventSchema = Schema.Literal(
  "APPROVE",
  "REQUEST_CHANGES",
  "COMMENT"
);

export type ReviewEvent = typeof ReviewEventSchema.Type;

const SubmitReviewSchema = Schema.Struct({
  body: Schema.NullOr(Schema.String),
  event: ReviewEventSchema,
});

export type SubmitReview = typeof SubmitReviewSchema.Type;
