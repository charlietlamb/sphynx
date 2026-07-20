import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform";
import { Schema } from "effect";
import {
  GitHubOwnerSchema,
  GitHubRateLimited,
  GitHubRepositorySchema,
  GitHubTimeout,
  GitHubUnavailable,
  GitHubUserSchema,
  InstallationRequired,
  PullRequestNotFound,
  PullRequestRefSchema,
  Unauthorized,
} from "./pull-requests";
import { cookieHeaders, installationHeaders, OkSchema } from "./shared";

/** Header naming the GitHub App installation a read should run through. */
export const INSTALLATION_HEADER = "x-sphynx-installation";

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

const PullStateSchema = Schema.Literal("open", "merged", "closed");

export type PullState = typeof PullStateSchema.Type;

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
  id: Schema.String,
  path: Schema.NullOr(Schema.String),
  rootCommentId: Schema.NullOr(Schema.Number),
});

export type ThreadPreview = typeof ThreadPreviewSchema.Type;

export const FailingCheckSchema = Schema.Struct({
  name: Schema.String,
  url: Schema.NullOr(Schema.String),
});

export type FailingCheck = typeof FailingCheckSchema.Type;

export const QueuePullSchema = Schema.Struct({
  owner: Schema.String,
  repo: Schema.String,
  number: Schema.Number,
  title: Schema.String,
  hasBody: Schema.Boolean,
  author: Schema.NullOr(GitHubUserSchema),
  isDraft: Schema.Boolean,
  state: PullStateSchema,
  mergedAt: Schema.NullOr(Schema.String),
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
  ciFailures: Schema.Array(FailingCheckSchema),
  ciCounts: Schema.Struct({
    failed: Schema.Number,
    passed: Schema.Number,
    pending: Schema.Number,
  }),
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
  body: Schema.NullOr(Schema.String),
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

/**
 * The queue without the promotion rail.
 *
 * Stages and gaps need a compare call per repo, which roughly doubles the
 * time to a first render. The queue itself only needs the open pulls, so it
 * is served first and the rail arrives separately.
 */
export const QueueFlowSchema = Schema.Struct({
  owner: Schema.String,
  repo: Schema.String,
  openPulls: Schema.Array(QueuePullSchema),
});

export type QueueFlow = typeof QueueFlowSchema.Type;

export const QueueSchema = Schema.Struct({
  repos: Schema.Array(QueueFlowSchema),
});

export type Queue = typeof QueueSchema.Type;

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

export const InstallationSchema = Schema.Struct({
  id: Schema.Number,
  accountLogin: Schema.String,
  accountType: Schema.String,
  avatarUrl: Schema.NullOr(Schema.String),
  repositorySelection: Schema.String,
});

export type Installation = typeof InstallationSchema.Type;

export const InstallationsSchema = Schema.Struct({
  installations: Schema.Array(InstallationSchema),
});

export type Installations = typeof InstallationsSchema.Type;

const listInstallations = HttpApiEndpoint.get(
  "listInstallations",
  "/api/github/installations"
)
  .setHeaders(cookieHeaders)
  .addSuccess(InstallationsSchema);

const getPipeline = HttpApiEndpoint.get("getPipeline", "/api/github/pipeline")
  .setHeaders(installationHeaders)
  .addSuccess(PipelineSchema);

const getQueue = HttpApiEndpoint.get("getQueue", "/api/github/queue")
  .setHeaders(installationHeaders)
  .addSuccess(QueueSchema);

export const PullBodySchema = Schema.Struct({
  body: Schema.NullOr(Schema.String),
});

export type PullBody = typeof PullBodySchema.Type;

const getPullBody = HttpApiEndpoint.get(
  "getPullBody",
  "/api/github/repos/:owner/:repo/pulls/:number/body"
)
  .setPath(PullRequestRefSchema)
  .setHeaders(installationHeaders)
  .addSuccess(PullBodySchema);

export const SearchResultsSchema = Schema.Struct({
  pulls: Schema.Array(QueuePullSchema),
  totalCount: Schema.Number,
});

export type SearchResults = typeof SearchResultsSchema.Type;

const searchPulls = HttpApiEndpoint.get(
  "searchPulls",
  "/api/github/search/pulls"
)
  .setUrlParams(
    Schema.Struct({
      q: Schema.String.pipe(Schema.minLength(1)),
      limit: Schema.optionalWith(
        Schema.NumberFromString.pipe(Schema.int(), Schema.between(1, 50)),
        { default: () => 30 }
      ),
    })
  )
  .setHeaders(installationHeaders)
  .addSuccess(SearchResultsSchema);

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
  .add(listInstallations)
  .add(getPipeline)
  .add(getQueue)
  .add(getPullBody)
  .add(searchPulls)
  .add(mergePull)
  .add(blockPull)
  .add(createPromotion)
  .addError(Unauthorized, { status: 401 })
  .addError(InstallationRequired, { status: 403 })
  .addError(PullRequestNotFound, { status: 404 })
  .addError(GitHubRateLimited, { status: 429 })
  .addError(GitHubUnavailable, { status: 502 })
  .addError(GitHubTimeout, { status: 504 });
