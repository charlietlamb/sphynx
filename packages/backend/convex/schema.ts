import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  ciStateValidator,
  decisionValidator,
  failingCheckValidator,
  githubUserValidator,
  pullStateValidator,
  reviewerVerdictValidator,
  threadPreviewValidator,
  workbenchEventFields,
} from "./github/validators";

export default defineSchema({
  reviewRepo: defineTable({
    key: v.string(),
    installationId: v.number(),
    owner: v.string(),
    repo: v.string(),
    defaultBranch: v.union(v.string(), v.null()),
    stages: v.array(v.string()),
  })
    .index("by_key", ["key"])
    .index("by_installation", ["installationId"])
    .index("by_owner", ["owner"]),

  reviewPull: defineTable({
    key: v.string(),
    repoKey: v.string(),
    installationId: v.number(),
    owner: v.string(),
    repo: v.string(),
    number: v.number(),
    state: pullStateValidator,
    title: v.string(),
    author: v.union(githubUserValidator, v.null()),
    isDraft: v.boolean(),
    hasBody: v.boolean(),
    baseRef: v.string(),
    headRef: v.string(),
    additions: v.number(),
    deletions: v.number(),
    changedFiles: v.number(),
    ci: ciStateValidator,
    ciCounts: v.object({
      failed: v.number(),
      passed: v.number(),
      pending: v.number(),
    }),
    unresolvedThreads: v.number(),
    decision: decisionValidator,
    blocker: v.union(v.string(), v.null()),
    mergedAt: v.union(v.string(), v.null()),
    reviewers: v.array(reviewerVerdictValidator),
    ciFailures: v.array(failingCheckValidator),
    threadPreviews: v.array(threadPreviewValidator),
    ghUpdatedAt: v.number(),
    fetchedAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_installation_and_state", ["installationId", "state"])
    .index("by_repo_and_state", ["repoKey", "state"])
    .index("by_state_and_fetchedAt", ["state", "fetchedAt"]),

  stageGap: defineTable({
    repoKey: v.string(),
    installationId: v.number(),
    fromStage: v.string(),
    toStage: v.string(),
    aheadBy: v.number(),
    directCommits: v.number(),
    promotionPull: v.union(v.number(), v.null()),
    pulls: v.array(
      v.object({
        number: v.number(),
        title: v.string(),
        body: v.union(v.string(), v.null()),
        author: v.union(githubUserValidator, v.null()),
        mergedAt: v.union(v.string(), v.null()),
      }),
    ),
  })
    .index("by_repo", ["repoKey"])
    .index("by_installation", ["installationId"]),

  pullHead: defineTable({
    installationId: v.number(),
    owner: v.string(),
    repo: v.string(),
    number: v.number(),
    headSha: v.string(),
  })
    .index("by_owner_and_repo_and_number", ["owner", "repo", "number"])
    .index("by_owner_and_repo_and_headSha", ["owner", "repo", "headSha"]),

  workbenchEvent: defineTable(workbenchEventFields)
    .index("by_eventId", ["eventId"])
    .index("by_occurredAt", ["occurredAt"])
    .index("by_installation_and_repo_and_occurredAt", [
      "installationId",
      "owner",
      "repo",
      "occurredAt",
    ]),

  webhookDelivery: defineTable({
    deliveryId: v.string(),
    eventType: v.string(),
    installationId: v.union(v.number(), v.null()),
    receivedAt: v.number(),
  })
    .index("by_deliveryId", ["deliveryId"])
    .index("by_receivedAt", ["receivedAt"]),

  installation: defineTable({
    installationId: v.number(),
    reconciledAt: v.union(v.number(), v.null()),
  }).index("by_installationId", ["installationId"]),

  installationToken: defineTable({
    installationId: v.number(),
    token: v.string(),
    expiresAt: v.number(),
  }).index("by_installationId", ["installationId"]),

  pullRefresh: defineTable({
    key: v.string(),
    installationId: v.number(),
    owner: v.string(),
    repo: v.string(),
    number: v.number(),
    status: v.union(v.literal("running"), v.literal("pending")),
  }).index("by_key", ["key"]),
});
