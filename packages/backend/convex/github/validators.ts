import { v } from "convex/values";

export const ciStateValidator = v.union(
  v.literal("success"),
  v.literal("failure"),
  v.literal("pending"),
  v.literal("none"),
);

export const decisionValidator = v.union(
  v.literal("ready"),
  v.literal("contested"),
  v.literal("needs-eyes"),
  v.literal("draft"),
);

export const pullStateValidator = v.union(
  v.literal("open"),
  v.literal("merged"),
  v.literal("closed"),
);

export const sourceKindValidator = v.union(v.literal("bot"), v.literal("human"));

export const reviewerStateValidator = v.union(
  v.literal("approved"),
  v.literal("changes-requested"),
  v.literal("commented"),
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
