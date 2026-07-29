import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { shouldApplyPullWrite } from "./gate";
import { pullDocFrom } from "./rows";
import { queuePullValidator } from "./validators";

/**
 * Write one pull through the monotonicity gate. Reads the current row by its
 * deterministic key, applies the last-writer-wins + terminal-state guard, and
 * inserts or patches only when the incoming write wins. Idempotent: a losing
 * write is a no-op. Returns whether the write was applied.
 */
export const writePull = internalMutation({
  args: {
    installationId: v.number(),
    repoKey: v.string(),
    owner: v.string(),
    repo: v.string(),
    pull: queuePullValidator,
    snapshotAt: v.number(),
    fetchedAt: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const doc = pullDocFrom(
      args.installationId,
      args.repoKey,
      args.owner,
      args.repo,
      args.pull,
    );
    const existing = await ctx.db
      .query("reviewPull")
      .withIndex("by_key", (q) => q.eq("key", doc.key))
      .unique();
    const applies = shouldApplyPullWrite(
      existing === null
        ? null
        : {
            state: existing.state,
            ghUpdatedAt: existing.ghUpdatedAt,
            fetchedAt: existing.fetchedAt,
          },
      { state: doc.state, ghUpdatedAt: doc.ghUpdatedAt },
      args.snapshotAt,
    );
    if (!applies) {
      return false;
    }
    const fields = { ...doc, fetchedAt: args.fetchedAt };
    if (existing === null) {
      await ctx.db.insert("reviewPull", fields);
    } else {
      await ctx.db.patch(existing._id, fields);
    }
    return true;
  },
});

/**
 * Ensure the repo row exists (webhooks carry no stages, so this never clobbers a
 * materialized stages array — it only fills in a missing parent).
 */
export const ensureRepo = internalMutation({
  args: {
    installationId: v.number(),
    owner: v.string(),
    repo: v.string(),
    repoKey: v.string(),
    stages: v.optional(v.array(v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("reviewRepo")
      .withIndex("by_key", (q) => q.eq("key", args.repoKey))
      .unique();
    if (existing === null) {
      await ctx.db.insert("reviewRepo", {
        key: args.repoKey,
        installationId: args.installationId,
        owner: args.owner,
        repo: args.repo,
        defaultBranch: null,
        stages: args.stages ?? [],
      });
      return null;
    }
    if (args.stages !== undefined) {
      await ctx.db.patch(existing._id, { stages: args.stages });
    }
    return null;
  },
});

/**
 * Close pulls that left the open set on a full rebuild — but only ones untouched
 * since the snapshot began. A pull a concurrent webhook opened during the
 * snapshot has `fetchedAt >= snapshotAt` and is spared, so a rebuild never marks
 * a freshly-opened PR merged just because it postdates the snapshot. Departed
 * open pulls coarsen to `merged` (matching the Postgres read model).
 */
export const closeDepartedPulls = internalMutation({
  args: {
    repoKey: v.string(),
    openNumbers: v.array(v.number()),
    snapshotAt: v.number(),
    now: v.number(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const open = new Set(args.openNumbers);
    const rows = await ctx.db
      .query("reviewPull")
      .withIndex("by_repo_and_state", (q) =>
        q.eq("repoKey", args.repoKey).eq("state", "open"),
      )
      .collect();
    let closed = 0;
    for (const row of rows) {
      if (row.fetchedAt < args.snapshotAt && !open.has(row.number)) {
        await ctx.db.patch(row._id, {
          state: "merged",
          fetchedAt: args.now,
        });
        closed += 1;
      }
    }
    return closed;
  },
});
