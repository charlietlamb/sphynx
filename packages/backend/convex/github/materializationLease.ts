import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";

const LEASE_MS = 10 * 60 * 1000;

export const claim = internalMutation({
  args: {
    installationId: v.number(),
    now: v.number(),
    runId: v.string(),
    seed: v.boolean(),
  },
  returns: v.union(v.literal("run"), v.literal("queued")),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("materializationLease")
      .withIndex("by_installation", (q) =>
        q.eq("installationId", args.installationId)
      )
      .unique();
    if (!existing) {
      await ctx.db.insert("materializationLease", {
        installationId: args.installationId,
        status: "running",
        leaseExpiresAt: args.now + LEASE_MS,
        runId: args.runId,
        seedRequested: args.seed,
      });
      return "run";
    }
    if (existing.leaseExpiresAt <= args.now) {
      await ctx.db.patch("materializationLease", existing._id, {
        status: "running",
        leaseExpiresAt: args.now + LEASE_MS,
        runId: args.runId,
        seedRequested: args.seed,
      });
      return "run";
    }
    if (
      existing.status === "running" ||
      (args.seed && !existing.seedRequested)
    ) {
      await ctx.db.patch("materializationLease", existing._id, {
        status: "pending",
        seedRequested: Boolean(existing.seedRequested || args.seed),
      });
    }
    return "queued";
  },
});

export const renew = internalMutation({
  args: { installationId: v.number(), now: v.number(), runId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("materializationLease")
      .withIndex("by_installation", (q) =>
        q.eq("installationId", args.installationId)
      )
      .unique();
    if (existing?.runId !== args.runId) {
      return false;
    }
    await ctx.db.patch("materializationLease", existing._id, {
      leaseExpiresAt: args.now + LEASE_MS,
    });
    return true;
  },
});

export const complete = internalMutation({
  args: { installationId: v.number(), now: v.number(), runId: v.string() },
  returns: v.union(v.literal("rerun"), v.literal("done"), v.literal("lost")),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("materializationLease")
      .withIndex("by_installation", (q) =>
        q.eq("installationId", args.installationId)
      )
      .unique();
    if (!existing) {
      return "done";
    }
    if (existing.runId !== args.runId) {
      return "lost";
    }
    if (existing.status === "pending") {
      const seed = existing.seedRequested ?? false;
      await ctx.db.delete("materializationLease", existing._id);
      await ctx.scheduler.runAfter(0, internal.github.materialize.materialize, {
        installationId: args.installationId,
        seed,
      });
      return "rerun";
    }
    await ctx.db.delete("materializationLease", existing._id);
    return "done";
  },
});

export const release = internalMutation({
  args: {
    installationId: v.number(),
    runId: v.string(),
    seed: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("materializationLease")
      .withIndex("by_installation", (q) =>
        q.eq("installationId", args.installationId)
      )
      .unique();
    if (existing?.runId === args.runId) {
      const pending = existing.status === "pending";
      await ctx.db.delete("materializationLease", existing._id);
      if (pending) {
        await ctx.scheduler.runAfter(
          0,
          internal.github.materialize.materialize,
          {
            installationId: args.installationId,
            seed: Boolean(existing.seedRequested || args.seed),
          }
        );
      }
    }
    return null;
  },
});
