import { Schema } from "effect";
import { GitHubUserSchema } from "./pull-requests";

const ConversationCommentSchema = Schema.Struct({
  id: Schema.String,
  author: Schema.NullOr(GitHubUserSchema),
  body: Schema.String,
  bodyHTML: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  githubUrl: Schema.String,
});

export type ConversationComment = typeof ConversationCommentSchema.Type;

const ConversationVerdictSchema = Schema.Literal(
  "approved",
  "changes-requested",
  "commented",
  "dismissed"
);

export type ConversationVerdict = typeof ConversationVerdictSchema.Type;

const ConversationReviewSchema = Schema.Struct({
  id: Schema.String,
  author: Schema.NullOr(GitHubUserSchema),
  isBot: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  verdict: ConversationVerdictSchema,
  body: Schema.String,
  bodyHTML: Schema.NullOr(Schema.String),
  submittedAt: Schema.String,
  githubUrl: Schema.String,
  commentCount: Schema.Number,
});

export type ConversationReview = typeof ConversationReviewSchema.Type;

const ConversationEventKindSchema = Schema.Literal(
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

const ConversationEventSchema = Schema.Struct({
  id: Schema.String,
  kind: ConversationEventKindSchema,
  at: Schema.String,
  actor: Schema.NullOr(GitHubUserSchema),
  detail: Schema.NullOr(Schema.String),
  ref: Schema.NullOr(Schema.String),
  url: Schema.NullOr(Schema.String),
});

export type ConversationEvent = typeof ConversationEventSchema.Type;

const ConversationSchema = Schema.Struct({
  descriptionHTML: Schema.NullOr(Schema.String),
  comments: Schema.Array(ConversationCommentSchema),
  reviews: Schema.Array(ConversationReviewSchema),
  events: Schema.Array(ConversationEventSchema),
});

export type Conversation = typeof ConversationSchema.Type;
