import { type Infer, v } from "convex/values";

/**
 * The read-model wire contract, defined once as Convex validators so the same
 * definition validates the database rows, the query args/returns, and — via
 * `Infer` — the TypeScript types the frontend consumes. Convex validates every
 * read at the wire, so these shapes are never re-decoded on the client; the
 * frontend imports the `Infer`-derived types only. Raw GitHub API payloads are a
 * separate, untrusted boundary and stay Effect Schema in the backend.
 */

export const ciStateValidator = v.union(
  v.literal("success"),
  v.literal("failure"),
  v.literal("pending"),
  v.literal("none")
);

export const decisionValidator = v.union(
  v.literal("ready"),
  v.literal("contested"),
  v.literal("needs-eyes"),
  v.literal("draft")
);

export const pullStateValidator = v.union(
  v.literal("open"),
  v.literal("merged"),
  v.literal("closed")
);

export const sourceKindValidator = v.union(
  v.literal("bot"),
  v.literal("human")
);

export const reviewerStateValidator = v.union(
  v.literal("approved"),
  v.literal("changes-requested"),
  v.literal("commented")
);

export const githubUserValidator = v.object({
  login: v.string(),
  avatarUrl: v.union(v.string(), v.null()),
});

export const reviewerVerdictValidator = v.object({
  name: v.string(),
  kind: sourceKindValidator,
  avatarUrl: v.union(v.string(), v.null()),
  state: reviewerStateValidator,
  score: v.union(v.string(), v.null()),
  submittedAt: v.string(),
});

export const threadPreviewValidator = v.object({
  author: v.union(githubUserValidator, v.null()),
  body: v.string(),
  id: v.string(),
  path: v.union(v.string(), v.null()),
  rootCommentId: v.union(v.number(), v.null()),
});

export const failingCheckValidator = v.object({
  name: v.string(),
  url: v.union(v.string(), v.null()),
});

export const ciCountsValidator = v.object({
  failed: v.number(),
  passed: v.number(),
  pending: v.number(),
});

export const queuePullValidator = v.object({
  owner: v.string(),
  repo: v.string(),
  number: v.number(),
  title: v.string(),
  hasBody: v.boolean(),
  author: v.union(githubUserValidator, v.null()),
  isDraft: v.boolean(),
  state: pullStateValidator,
  mergedAt: v.union(v.string(), v.null()),
  updatedAt: v.string(),
  additions: v.number(),
  deletions: v.number(),
  changedFiles: v.number(),
  ci: ciStateValidator,
  headRefName: v.string(),
  baseRefName: v.string(),
  reviewers: v.array(reviewerVerdictValidator),
  reviewerCount: v.number(),
  botReviewerCount: v.number(),
  approvals: v.number(),
  changesRequested: v.number(),
  unresolvedThreads: v.number(),
  ciFailures: v.array(failingCheckValidator),
  ciCounts: ciCountsValidator,
  threadPreviews: v.array(threadPreviewValidator),
  decision: decisionValidator,
  blocker: v.union(v.string(), v.null()),
});

export const promotedPullValidator = v.object({
  number: v.number(),
  title: v.string(),
  body: v.union(v.string(), v.null()),
  author: v.union(githubUserValidator, v.null()),
  mergedAt: v.union(v.string(), v.null()),
});

export const stageGapValidator = v.object({
  from: v.string(),
  to: v.string(),
  aheadBy: v.number(),
  pulls: v.array(promotedPullValidator),
  directCommits: v.number(),
  promotionPull: v.union(v.number(), v.null()),
});

export const repoFlowValidator = v.object({
  owner: v.string(),
  repo: v.string(),
  stages: v.array(v.string()),
  openPulls: v.array(queuePullValidator),
  gaps: v.array(stageGapValidator),
});

export const pipelineValidator = v.object({
  repos: v.array(repoFlowValidator),
});

export const discoveredRepoValidator = v.object({
  owner: v.string(),
  repo: v.string(),
  openPulls: v.number(),
});

export const installationValidator = v.object({
  id: v.number(),
  accountLogin: v.string(),
  accountType: v.string(),
  avatarUrl: v.union(v.string(), v.null()),
  repositorySelection: v.string(),
});

export const workbenchEventKindValidator = v.union(
  v.literal("pr-opened"),
  v.literal("pr-merged"),
  v.literal("pr-closed"),
  v.literal("pr-reopened"),
  v.literal("pr-ready"),
  v.literal("review-approved"),
  v.literal("review-changes"),
  v.literal("review-commented"),
  v.literal("comment"),
  v.literal("push"),
  v.literal("branch-created"),
  v.literal("branch-deleted"),
  v.literal("release")
);

export const workbenchEventValidator = v.object({
  id: v.string(),
  at: v.string(),
  actor: v.object({ login: v.string(), avatarUrl: v.string() }),
  kind: workbenchEventKindValidator,
  pull: v.union(
    v.object({ number: v.number(), title: v.union(v.string(), v.null()) }),
    v.null()
  ),
  detail: v.union(v.string(), v.null()),
  url: v.union(v.string(), v.null()),
});

export const workbenchEventFields = {
  eventId: v.string(),
  installationId: v.number(),
  owner: v.string(),
  repo: v.string(),
  kind: v.string(),
  actor: v.union(v.string(), v.null()),
  actorAvatarUrl: v.union(v.string(), v.null()),
  pullNumber: v.union(v.number(), v.null()),
  title: v.union(v.string(), v.null()),
  detail: v.union(v.string(), v.null()),
  url: v.union(v.string(), v.null()),
  occurredAt: v.number(),
};

export const workbenchEventInput = v.object(workbenchEventFields);

export type CiState = Infer<typeof ciStateValidator>;
export type Decision = Infer<typeof decisionValidator>;
export type PullState = Infer<typeof pullStateValidator>;
export type SourceKind = Infer<typeof sourceKindValidator>;
export type ReviewerState = Infer<typeof reviewerStateValidator>;
export type GitHubUser = Infer<typeof githubUserValidator>;
export type ReviewerVerdict = Infer<typeof reviewerVerdictValidator>;
export type ThreadPreview = Infer<typeof threadPreviewValidator>;
export type FailingCheck = Infer<typeof failingCheckValidator>;
export type CiCounts = Infer<typeof ciCountsValidator>;
export type QueuePull = Infer<typeof queuePullValidator>;
export type PromotedPull = Infer<typeof promotedPullValidator>;
export type StageGap = Infer<typeof stageGapValidator>;
export type RepoFlow = Infer<typeof repoFlowValidator>;
export type Pipeline = Infer<typeof pipelineValidator>;
export type DiscoveredRepo = Infer<typeof discoveredRepoValidator>;
export type Installation = Infer<typeof installationValidator>;
export type WorkbenchEventKind = Infer<typeof workbenchEventKindValidator>;
export type WorkbenchEvent = Infer<typeof workbenchEventValidator>;
