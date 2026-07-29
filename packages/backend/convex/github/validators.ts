import type * as Contract from "@sphynx/schema/read-model";
import { type Infer, v } from "convex/values";

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
  rootCommentId: v.union(v.string(), v.null()),
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

export const workbenchEventFields = {
  eventId: v.string(),
  installationId: v.number(),
  owner: v.string(),
  repo: v.string(),
  kind: workbenchEventKindValidator,
  actor: v.union(v.string(), v.null()),
  actorAvatarUrl: v.union(v.string(), v.null()),
  pullNumber: v.union(v.number(), v.null()),
  title: v.union(v.string(), v.null()),
  detail: v.union(v.string(), v.null()),
  url: v.union(v.string(), v.null()),
  occurredAt: v.number(),
};

export const workbenchEventInput = v.object(workbenchEventFields);

/**
 * These Convex validators must stay structurally identical to the canonical
 * shared contract in `@sphynx/schema/read-model` — the frontend derives its
 * types from there, and Convex cannot bundle that package's validator values, so
 * they are re-authored here for `defineTable`/args/returns. This assertion turns
 * any drift between the two into a compile error rather than a wire mismatch.
 */
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type AssertExact<A, B> = Exact<A, B> extends true ? true : never;

export const contractParity: [
  AssertExact<Infer<typeof queuePullValidator>, Contract.QueuePull>,
  AssertExact<Infer<typeof pipelineValidator>, Contract.Pipeline>,
  AssertExact<Infer<typeof repoFlowValidator>, Contract.RepoFlow>,
  AssertExact<Infer<typeof stageGapValidator>, Contract.StageGap>,
  AssertExact<Infer<typeof promotedPullValidator>, Contract.PromotedPull>,
  AssertExact<Infer<typeof reviewerVerdictValidator>, Contract.ReviewerVerdict>,
  AssertExact<Infer<typeof threadPreviewValidator>, Contract.ThreadPreview>,
  AssertExact<Infer<typeof failingCheckValidator>, Contract.FailingCheck>,
  AssertExact<Infer<typeof ciStateValidator>, Contract.CiState>,
  AssertExact<Infer<typeof decisionValidator>, Contract.Decision>,
  AssertExact<Infer<typeof pullStateValidator>, Contract.PullState>,
  AssertExact<
    Infer<typeof workbenchEventKindValidator>,
    Contract.WorkbenchEventKind
  >,
] = [true, true, true, true, true, true, true, true, true, true, true, true];
