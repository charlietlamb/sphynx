import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";

const LEASE_MS = 2 * 60 * 1000;

const refreshKey = (
  installationId: number,
  owner: string,
  repo: string,
  number: number
) => `${installationId}:${owner.toLowerCase()}/${repo.toLowerCase()}#${number}`;

/**
 * Claim a PR refresh, coalescing a burst. A CI matrix firing 50 check_run
 * deliveries for one PR would otherwise be 50 GitHub refetches whose final state
 * is identical. The first claim wins and returns "run"; while it runs, later
 * claims only flag the row `pending` and return "queued". This replaces the
 * source server's in-process `running`/`pending` Ref sets with a serializable
 * row, so it coalesces across a stateless, multi-invocation backend.
 */
export const claimRefresh = internalMutation({
  args: {
    installationId: v.number(),
    owner: v.string(),
    repo: v.string(),
    number: v.number(),
    now: v.number(),
    runId: v.string(),
  },
  returns: v.union(v.literal("run"), v.literal("queued")),
  handler: async (ctx, args) => {
    const key = refreshKey(
      args.installationId,
      args.owner,
      args.repo,
      args.number
    );
    const existing = await ctx.db
      .query("pullRefresh")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (existing === null) {
      await ctx.db.insert("pullRefresh", {
        key,
        installationId: args.installationId,
        owner: args.owner,
        repo: args.repo,
        number: args.number,
        status: "running",
        leaseExpiresAt: args.now + LEASE_MS,
        runId: args.runId,
      });
      return "run";
    }
    if ((existing.leaseExpiresAt ?? 0) <= args.now) {
      await ctx.db.patch("pullRefresh", existing._id, {
        status: "running",
        leaseExpiresAt: args.now + LEASE_MS,
        runId: args.runId,
      });
      return "run";
    }
    if (existing.status !== "pending") {
      await ctx.db.patch("pullRefresh", existing._id, { status: "pending" });
    }
    return "queued";
  },
});

/**
 * Finish a PR refresh. If a delivery landed while it ran (`pending`), reset to
 * `running` and return "rerun" so the runner loops once more with the latest
 * state; otherwise clear the row and return "done".
 */
export const completeRefresh = internalMutation({
  args: {
    installationId: v.number(),
    owner: v.string(),
    repo: v.string(),
    number: v.number(),
    now: v.number(),
    runId: v.string(),
  },
  returns: v.union(v.literal("rerun"), v.literal("done"), v.literal("lost")),
  handler: async (ctx, args) => {
    const key = refreshKey(
      args.installationId,
      args.owner,
      args.repo,
      args.number
    );
    const existing = await ctx.db
      .query("pullRefresh")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (existing === null) {
      return "done";
    }
    if (existing.runId !== args.runId) {
      return "lost";
    }
    if (existing.status === "pending") {
      await ctx.db.patch("pullRefresh", existing._id, {
        status: "running",
        leaseExpiresAt: args.now + LEASE_MS,
      });
      return "rerun";
    }
    await ctx.db.delete("pullRefresh", existing._id);
    return "done";
  },
});

export const releaseRefresh = internalMutation({
  args: {
    installationId: v.number(),
    owner: v.string(),
    repo: v.string(),
    number: v.number(),
    runId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const key = refreshKey(
      args.installationId,
      args.owner,
      args.repo,
      args.number
    );
    const existing = await ctx.db
      .query("pullRefresh")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (existing?.runId === args.runId) {
      const pending = existing.status === "pending";
      await ctx.db.delete("pullRefresh", existing._id);
      if (pending) {
        await ctx.scheduler.runAfter(0, internal.github.project.refreshPull, {
          installationId: args.installationId,
          owner: args.owner,
          repo: args.repo,
          number: args.number,
        });
      }
    }
    return null;
  },
});
