import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform";
import { Schema } from "effect";
import { Unauthorized } from "./pull-request-views";
import {
  GitHubOwnerSchema,
  GitHubRateLimited,
  GitHubRepositorySchema,
  GitHubTimeout,
  GitHubUnavailable,
  GitHubUserSchema,
  PullRequestNotFound,
  PullRequestRefSchema,
} from "./pull-requests";
import { cookieHeaders, OkSchema } from "./shared";

export const DiscoveredRepoSchema = Schema.Struct({
  owner: Schema.String,
  repo: Schema.String,
  openPulls: Schema.Number,
});

export type DiscoveredRepo = typeof DiscoveredRepoSchema.Type;

const CiStateSchema = Schema.Literal("success", "failure", "pending", "none");

export type CiState = typeof CiStateSchema.Type;

const DecisionSchema = Schema.Literal(
  "ready",
  "contested",
  "needs-eyes",
  "draft"
);

export type Decision = typeof DecisionSchema.Type;

const SourceKindSchema = Schema.Literal("bot", "human");

export const ReviewerVerdictSchema = Schema.Struct({
  name: Schema.String,
  kind: SourceKindSchema,
  avatarUrl: Schema.NullOr(Schema.String),
  state: Schema.Literal("approved", "changes-requested", "commented"),
  score: Schema.NullOr(Schema.String),
  submittedAt: Schema.String,
});

export type ReviewerVerdict = typeof ReviewerVerdictSchema.Type;

export const ThreadPreviewSchema = Schema.Struct({
  author: Schema.NullOr(GitHubUserSchema),
  body: Schema.String,
  path: Schema.NullOr(Schema.String),
});

export type ThreadPreview = typeof ThreadPreviewSchema.Type;

export const QueuePullSchema = Schema.Struct({
  owner: Schema.String,
  repo: Schema.String,
  number: Schema.Number,
  title: Schema.String,
  author: Schema.NullOr(GitHubUserSchema),
  isDraft: Schema.Boolean,
  updatedAt: Schema.String,
  additions: Schema.Number,
  deletions: Schema.Number,
  changedFiles: Schema.Number,
  ci: CiStateSchema,
  headRefName: Schema.String,
  baseRefName: Schema.String,
  reviewers: Schema.Array(ReviewerVerdictSchema),
  reviewerCount: Schema.Number,
  botReviewerCount: Schema.Number,
  approvals: Schema.Number,
  changesRequested: Schema.Number,
  unresolvedThreads: Schema.Number,
  ciFailures: Schema.Array(Schema.String),
  threadPreviews: Schema.Array(ThreadPreviewSchema),
  decision: DecisionSchema,
  blocker: Schema.NullOr(Schema.String),
});

export type QueuePull = typeof QueuePullSchema.Type;

export const BlockPullSchema = Schema.Struct({
  body: Schema.String.pipe(Schema.minLength(1)),
});

export const PromotedPullSchema = Schema.Struct({
  number: Schema.Number,
  title: Schema.String,
  author: Schema.NullOr(GitHubUserSchema),
  mergedAt: Schema.NullOr(Schema.String),
});

export type PromotedPull = typeof PromotedPullSchema.Type;

export const StageGapSchema = Schema.Struct({
  from: Schema.String,
  to: Schema.String,
  aheadBy: Schema.Number,
  pulls: Schema.Array(PromotedPullSchema),
  directCommits: Schema.Number,
  promotionPull: Schema.NullOr(Schema.Number),
});

export type StageGap = typeof StageGapSchema.Type;

export const RepoFlowSchema = Schema.Struct({
  owner: Schema.String,
  repo: Schema.String,
  stages: Schema.Array(Schema.String),
  openPulls: Schema.Array(QueuePullSchema),
  gaps: Schema.Array(StageGapSchema),
});

export type RepoFlow = typeof RepoFlowSchema.Type;

export const PipelineSchema = Schema.Struct({
  repos: Schema.Array(RepoFlowSchema),
});

export type Pipeline = typeof PipelineSchema.Type;

export const RepoRefSchema = Schema.Struct({
  owner: GitHubOwnerSchema,
  repo: GitHubRepositorySchema,
});

export const PromoteSchema = Schema.Struct({
  from: Schema.String.pipe(Schema.minLength(1)),
  to: Schema.String.pipe(Schema.minLength(1)),
});

export const CreatedPullSchema = Schema.Struct({ number: Schema.Number });

const createPromotion = HttpApiEndpoint.post(
  "createPromotion",
  "/api/github/repos/:owner/:repo/promote"
)
  .setPath(RepoRefSchema)
  .setHeaders(cookieHeaders)
  .setPayload(PromoteSchema)
  .addSuccess(CreatedPullSchema);

const getPipeline = HttpApiEndpoint.get("getPipeline", "/api/github/pipeline")
  .setHeaders(cookieHeaders)
  .addSuccess(PipelineSchema);

const getDevPipeline = HttpApiEndpoint.get(
  "getDevPipeline",
  "/api/dev/pipeline"
).addSuccess(PipelineSchema);

const mergePull = HttpApiEndpoint.post(
  "mergePull",
  "/api/github/repos/:owner/:repo/pulls/:number/merge"
)
  .setPath(PullRequestRefSchema)
  .setHeaders(cookieHeaders)
  .addSuccess(OkSchema);

const blockPull = HttpApiEndpoint.post(
  "blockPull",
  "/api/github/repos/:owner/:repo/pulls/:number/block"
)
  .setPath(PullRequestRefSchema)
  .setHeaders(cookieHeaders)
  .setPayload(BlockPullSchema)
  .addSuccess(OkSchema);

export const ReviewQueueApi = HttpApiGroup.make("reviewQueue")
  .add(getPipeline)
  .add(getDevPipeline)
  .add(mergePull)
  .add(blockPull)
  .add(createPromotion)
  .addError(Unauthorized, { status: 401 })
  .addError(PullRequestNotFound, { status: 404 })
  .addError(GitHubRateLimited, { status: 429 })
  .addError(GitHubUnavailable, { status: 502 })
  .addError(GitHubTimeout, { status: 504 });
