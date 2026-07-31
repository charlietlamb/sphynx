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
import { webhookJobValidator } from "./github/webhookJob";

export default defineSchema({
  reviewRepo: defineTable({
    key: v.string(),
    installationId: v.number(),
    owner: v.string(),
    repo: v.string(),
    defaultBranch: v.union(v.string(), v.null()),
    stages: v.array(v.string()),
    presenceSeenAt: v.optional(v.number()),
  })
    .index("by_key", ["key"])
    .index("by_installation", ["installationId"])
    .index("by_installation_and_presence", [
      "installationId",
      "presenceSeenAt",
    ]),

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
    presenceSeenAt: v.optional(v.number()),
  })
    .index("by_key", ["key"])
    .index("by_installation_and_state", ["installationId", "state"])
    .index("by_repo_and_state_and_presence", [
      "repoKey",
      "state",
      "presenceSeenAt",
    ])
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
      })
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
    .index("by_installation_and_owner_and_repo_and_number", [
      "installationId",
      "owner",
      "repo",
      "number",
    ])
    .index("by_installation_and_owner_and_repo_and_headSha", [
      "installationId",
      "owner",
      "repo",
      "headSha",
    ]),

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
    job: v.optional(webhookJobValidator),
    status: v.optional(
      v.union(
        v.literal("queued"),
        v.literal("running"),
        v.literal("succeeded"),
        v.literal("failed")
      )
    ),
    attempts: v.optional(v.number()),
    lastError: v.optional(v.string()),
    leaseExpiresAt: v.optional(v.number()),
  })
    .index("by_deliveryId", ["deliveryId"])
    .index("by_receivedAt", ["receivedAt"])
    .index("by_status_and_receivedAt", ["status", "receivedAt"])
    .index("by_status_and_lease", ["status", "leaseExpiresAt"]),

  installation: defineTable({
    installationId: v.number(),
    reconciledAt: v.union(v.number(), v.null()),
    reconcileAttemptedAt: v.optional(v.number()),
    retiredAt: v.optional(v.number()),
    lastWebhookAt: v.optional(v.number()),
    lastProjectedAt: v.optional(v.number()),
  })
    .index("by_installationId", ["installationId"])
    .index("by_reconcileAttemptedAt", ["reconcileAttemptedAt"]),

  userInstallation: defineTable({
    userId: v.string(),
    installationId: v.number(),
    accountLogin: v.string(),
    accountType: v.optional(v.string()),
    avatarUrl: v.optional(v.union(v.string(), v.null())),
    repositorySelection: v.optional(v.string()),
    verifiedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_installation", ["userId", "installationId"]),

  userRepository: defineTable({
    userId: v.string(),
    installationId: v.number(),
    repoKey: v.string(),
    verifiedAt: v.number(),
  })
    .index("by_user_and_installation_and_verifiedAt", [
      "userId",
      "installationId",
      "verifiedAt",
    ])
    .index("by_user_and_installation_and_repo_and_verifiedAt", [
      "userId",
      "installationId",
      "repoKey",
      "verifiedAt",
    ])
    .index("by_user_and_verifiedAt", ["userId", "verifiedAt"]),

  userAccessRefresh: defineTable({
    userId: v.string(),
    runId: v.string(),
    status: v.union(
      v.literal("refreshing"),
      v.literal("completed"),
      v.literal("aborted")
    ),
    verifiedAt: v.number(),
    leaseExpiresAt: v.number(),
  }).index("by_user", ["userId"]),

  installationToken: defineTable({
    installationId: v.number(),
    token: v.string(),
    expiresAt: v.number(),
  })
    .index("by_installationId", ["installationId"])
    .index("by_expiresAt", ["expiresAt"]),

  pullRefresh: defineTable({
    key: v.string(),
    installationId: v.number(),
    owner: v.string(),
    repo: v.string(),
    number: v.number(),
    status: v.union(v.literal("running"), v.literal("pending")),
    leaseExpiresAt: v.optional(v.number()),
    runId: v.optional(v.string()),
  })
    .index("by_key", ["key"])
    .index("by_installation", ["installationId"])
    .index("by_leaseExpiresAt", ["leaseExpiresAt"]),

  materializationLease: defineTable({
    installationId: v.number(),
    status: v.union(v.literal("running"), v.literal("pending")),
    leaseExpiresAt: v.number(),
    runId: v.optional(v.string()),
    seedRequested: v.optional(v.boolean()),
  })
    .index("by_installation", ["installationId"])
    .index("by_leaseExpiresAt", ["leaseExpiresAt"]),

  rateLimit: defineTable({
    key: v.string(),
    count: v.number(),
    windowStartedAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_windowStartedAt", ["windowStartedAt"]),
});
