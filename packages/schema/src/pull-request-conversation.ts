import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform";
import { Schema } from "effect";
import {
  GitHubRateLimited,
  GitHubTimeout,
  GitHubUnavailable,
  GitHubUserSchema,
  InstallationRequired,
  PullRequestNotFound,
  PullRequestRefSchema,
  Unauthorized,
} from "./pull-requests";
import { cookieHeaders } from "./shared";

export const ConversationCommentSchema = Schema.Struct({
  id: Schema.String,
  author: Schema.NullOr(GitHubUserSchema),
  body: Schema.String,
  bodyHTML: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  githubUrl: Schema.String,
});

export type ConversationComment = typeof ConversationCommentSchema.Type;

export const ConversationVerdictSchema = Schema.Literal(
  "approved",
  "changes-requested",
  "commented",
  "dismissed"
);

export type ConversationVerdict = typeof ConversationVerdictSchema.Type;

export const ConversationReviewSchema = Schema.Struct({
  id: Schema.String,
  author: Schema.NullOr(GitHubUserSchema),
  verdict: ConversationVerdictSchema,
  body: Schema.String,
  bodyHTML: Schema.NullOr(Schema.String),
  submittedAt: Schema.String,
  githubUrl: Schema.String,
  commentCount: Schema.Number,
});

export type ConversationReview = typeof ConversationReviewSchema.Type;

export const ConversationEventKindSchema = Schema.Literal(
  "commit",
  "force-push",
  "labeled",
  "unlabeled",
  "review-requested",
  "assigned",
  "merged",
  "closed",
  "reopened",
  "renamed"
);

export type ConversationEventKind = typeof ConversationEventKindSchema.Type;

export const ConversationEventSchema = Schema.Struct({
  id: Schema.String,
  kind: ConversationEventKindSchema,
  at: Schema.String,
  actor: Schema.NullOr(GitHubUserSchema),
  detail: Schema.NullOr(Schema.String),
  ref: Schema.NullOr(Schema.String),
  url: Schema.NullOr(Schema.String),
});

export type ConversationEvent = typeof ConversationEventSchema.Type;

export const ConversationSchema = Schema.Struct({
  descriptionHTML: Schema.NullOr(Schema.String),
  comments: Schema.Array(ConversationCommentSchema),
  reviews: Schema.Array(ConversationReviewSchema),
  events: Schema.Array(ConversationEventSchema),
});

export type Conversation = typeof ConversationSchema.Type;

export const AddConversationCommentSchema = Schema.Struct({
  body: Schema.String.pipe(Schema.minLength(1)),
});

export type AddConversationComment = typeof AddConversationCommentSchema.Type;

const getConversation = HttpApiEndpoint.get(
  "getConversation",
  "/api/github/repos/:owner/:repo/pulls/:number/conversation"
)
  .setPath(PullRequestRefSchema)
  .setHeaders(cookieHeaders)
  .addSuccess(ConversationSchema);

const addConversationComment = HttpApiEndpoint.post(
  "addConversationComment",
  "/api/github/repos/:owner/:repo/pulls/:number/conversation-comments"
)
  .setPath(PullRequestRefSchema)
  .setHeaders(cookieHeaders)
  .setPayload(AddConversationCommentSchema)
  .addSuccess(ConversationCommentSchema);

export const PullRequestConversationApi = HttpApiGroup.make(
  "pullRequestConversation"
)
  .add(getConversation)
  .add(addConversationComment)
  .addError(Unauthorized, { status: 401 })
  .addError(InstallationRequired, { status: 403 })
  .addError(PullRequestNotFound, { status: 404 })
  .addError(GitHubRateLimited, { status: 429 })
  .addError(GitHubUnavailable, { status: 502 })
  .addError(GitHubTimeout, { status: 504 });
