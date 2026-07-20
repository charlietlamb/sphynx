import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform";
import { Schema } from "effect";
import {
  GitHubRateLimited,
  GitHubTimeout,
  GitHubUnavailable,
  InstallationRequired,
  PullRequestNotFound,
  PullRequestRefSchema,
  Unauthorized,
} from "./pull-requests";
import { cookieHeaders, OkSchema } from "./shared";

const CommentSideSchema = Schema.Literal("additions", "deletions");

export const ReviewCommentSchema = Schema.Struct({
  id: Schema.Number,
  body: Schema.String,
  author: Schema.NullOr(
    Schema.Struct({ login: Schema.String, avatarUrl: Schema.String })
  ),
  createdAt: Schema.String,
  githubUrl: Schema.String,
  pending: Schema.Boolean,
});

export type ReviewComment = typeof ReviewCommentSchema.Type;

export const ReviewThreadSchema = Schema.Struct({
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

export const ReviewThreadsSchema = Schema.Struct({
  threads: Schema.Array(ReviewThreadSchema),
});

export type ReviewThreads = typeof ReviewThreadsSchema.Type;

export const CreateReviewCommentSchema = Schema.Struct({
  body: Schema.String.pipe(Schema.minLength(1)),
  commitSha: Schema.String,
  path: Schema.String,
  line: Schema.Number,
  side: CommentSideSchema,
  startLine: Schema.NullOr(Schema.Number),
  pending: Schema.Boolean,
});

export type CreateReviewComment = typeof CreateReviewCommentSchema.Type;

export const ReplyPayloadSchema = Schema.Struct({
  body: Schema.String.pipe(Schema.minLength(1)),
  commentId: Schema.Number,
});

export type ReplyPayload = typeof ReplyPayloadSchema.Type;

export const ResolveThreadSchema = Schema.Struct({
  threadId: Schema.String,
  resolved: Schema.Boolean,
});

export type ResolveThread = typeof ResolveThreadSchema.Type;

export const PendingReviewSchema = Schema.Struct({
  pendingId: Schema.NullOr(Schema.String),
  commentCount: Schema.Number,
});

export type PendingReview = typeof PendingReviewSchema.Type;

export const ReviewEventSchema = Schema.Literal(
  "APPROVE",
  "REQUEST_CHANGES",
  "COMMENT"
);

export type ReviewEvent = typeof ReviewEventSchema.Type;

export const SubmitReviewSchema = Schema.Struct({
  body: Schema.NullOr(Schema.String),
  event: ReviewEventSchema,
});

export type SubmitReview = typeof SubmitReviewSchema.Type;

const listCommentThreads = HttpApiEndpoint.get(
  "listCommentThreads",
  "/api/github/repos/:owner/:repo/pulls/:number/comment-threads"
)
  .setPath(PullRequestRefSchema)
  .setHeaders(cookieHeaders)
  .addSuccess(ReviewThreadsSchema);

const createReviewComment = HttpApiEndpoint.post(
  "createReviewComment",
  "/api/github/repos/:owner/:repo/pulls/:number/comments"
)
  .setPath(PullRequestRefSchema)
  .setHeaders(cookieHeaders)
  .setPayload(CreateReviewCommentSchema)
  .addSuccess(OkSchema);

const replyToComment = HttpApiEndpoint.post(
  "replyToComment",
  "/api/github/repos/:owner/:repo/pulls/:number/comment-replies"
)
  .setPath(PullRequestRefSchema)
  .setHeaders(cookieHeaders)
  .setPayload(ReplyPayloadSchema)
  .addSuccess(OkSchema);

const resolveThread = HttpApiEndpoint.post(
  "resolveThread",
  "/api/github/repos/:owner/:repo/pulls/:number/comment-threads/resolve"
)
  .setPath(PullRequestRefSchema)
  .setHeaders(cookieHeaders)
  .setPayload(ResolveThreadSchema)
  .addSuccess(OkSchema);

const getPendingReview = HttpApiEndpoint.get(
  "getPendingReview",
  "/api/github/repos/:owner/:repo/pulls/:number/pending-review"
)
  .setPath(PullRequestRefSchema)
  .setHeaders(cookieHeaders)
  .addSuccess(PendingReviewSchema);

const submitReview = HttpApiEndpoint.post(
  "submitReview",
  "/api/github/repos/:owner/:repo/pulls/:number/pending-review/submit"
)
  .setPath(PullRequestRefSchema)
  .setHeaders(cookieHeaders)
  .setPayload(SubmitReviewSchema)
  .addSuccess(OkSchema);

const discardReview = HttpApiEndpoint.post(
  "discardReview",
  "/api/github/repos/:owner/:repo/pulls/:number/pending-review/discard"
)
  .setPath(PullRequestRefSchema)
  .setHeaders(cookieHeaders)
  .addSuccess(OkSchema);

export const PullRequestCommentsApi = HttpApiGroup.make("pullRequestComments")
  .add(listCommentThreads)
  .add(createReviewComment)
  .add(replyToComment)
  .add(resolveThread)
  .add(getPendingReview)
  .add(submitReview)
  .add(discardReview)
  .addError(Unauthorized, { status: 401 })
  .addError(InstallationRequired, { status: 403 })
  .addError(PullRequestNotFound, { status: 404 })
  .addError(GitHubRateLimited, { status: 429 })
  .addError(GitHubUnavailable, { status: 502 })
  .addError(GitHubTimeout, { status: 504 });
