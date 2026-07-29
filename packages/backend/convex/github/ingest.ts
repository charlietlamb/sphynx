import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import { webhookJobValidator } from "./webhookJob";

const MAX_ATTEMPTS = 4;
const LEASE_MS = 2 * 60_000;
const QUEUED_RECOVERY_MS = 2 * 60_000;

/** Atomically deduplicate, persist, and enqueue a compact webhook job. */
export const recordDelivery = internalMutation({
  args: {
    deliveryId: v.string(),
    eventType: v.string(),
    receivedAt: v.number(),
    job: webhookJobValidator,
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("webhookDelivery")
      .withIndex("by_deliveryId", (q) => q.eq("deliveryId", args.deliveryId))
      .unique();
    if (existing === null) {
      await ctx.db.insert("webhookDelivery", {
        deliveryId: args.deliveryId,
        eventType: args.eventType,
        installationId: args.job.installationId,
        receivedAt: args.receivedAt,
        job: args.job,
        status: "queued",
        attempts: 0,
      });
    } else {
      if (existing.job) {
        return false;
      }
      await ctx.db.patch("webhookDelivery", existing._id, {
        eventType: args.eventType,
        installationId: args.job.installationId,
        receivedAt: args.receivedAt,
        job: args.job,
        status: "queued",
        attempts: 0,
      });
    }
    if (args.job.installationId !== null) {
      const installation = await ctx.db
        .query("installation")
        .withIndex("by_installationId", (q) =>
          q.eq("installationId", args.job.installationId as number)
        )
        .unique();
      if (!installation) {
        await ctx.db.insert("installation", {
          installationId: args.job.installationId,
          reconciledAt: null,
        });
      }
    }
    await ctx.scheduler.runAfter(0, internal.github.project.project, {
      deliveryId: args.deliveryId,
    });
    return true;
  },
});

export const claimDelivery = internalMutation({
  args: { deliveryId: v.string(), now: v.number() },
  returns: v.union(
    v.object({ job: webhookJobValidator, attempt: v.number() }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("webhookDelivery")
      .withIndex("by_deliveryId", (q) => q.eq("deliveryId", args.deliveryId))
      .unique();
    if (
      !row?.job ||
      row.status === "succeeded" ||
      row.status === "failed" ||
      (row.status === "running" && (row.leaseExpiresAt ?? 0) > args.now)
    ) {
      return null;
    }
    const attempt = (row.attempts ?? 0) + 1;
    await ctx.db.patch("webhookDelivery", row._id, {
      status: "running",
      attempts: attempt,
      lastError: undefined,
      leaseExpiresAt: args.now + LEASE_MS,
    });
    return { job: row.job, attempt };
  },
});

export const completeDelivery = internalMutation({
  args: {
    deliveryId: v.string(),
    attempt: v.number(),
    syncedAt: v.union(v.number(), v.null()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("webhookDelivery")
      .withIndex("by_deliveryId", (q) => q.eq("deliveryId", args.deliveryId))
      .unique();
    if (row?.status !== "running" || row.attempts !== args.attempt) {
      return false;
    }
    await ctx.db.patch("webhookDelivery", row._id, {
      status: "succeeded",
      lastError: undefined,
      leaseExpiresAt: undefined,
    });
    if (row.installationId !== null && args.syncedAt !== null) {
      const installation = await ctx.db
        .query("installation")
        .withIndex("by_installationId", (q) =>
          q.eq("installationId", row.installationId as number)
        )
        .unique();
      if (installation) {
        await ctx.db.patch("installation", installation._id, {
          lastProjectedAt: args.syncedAt,
        });
      }
    }
    return true;
  },
});

export const retryDelivery = internalMutation({
  args: {
    deliveryId: v.string(),
    attempt: v.number(),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("webhookDelivery")
      .withIndex("by_deliveryId", (q) => q.eq("deliveryId", args.deliveryId))
      .unique();
    if (row?.status !== "running" || row.attempts !== args.attempt) {
      return null;
    }
    if (args.attempt >= MAX_ATTEMPTS) {
      await ctx.db.patch("webhookDelivery", row._id, {
        status: "failed",
        lastError: args.error.slice(0, 500),
        leaseExpiresAt: undefined,
      });
      return null;
    }
    await ctx.db.patch("webhookDelivery", row._id, {
      status: "queued",
      lastError: args.error.slice(0, 500),
      leaseExpiresAt: undefined,
    });
    await ctx.scheduler.runAfter(
      2 ** (args.attempt - 1) * 1000,
      internal.github.project.project,
      { deliveryId: args.deliveryId }
    );
    return null;
  },
});

export const requeueExpiredDeliveries = internalMutation({
  args: { now: v.number() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const [running, queued] = await Promise.all([
      ctx.db
        .query("webhookDelivery")
        .withIndex("by_status_and_lease", (q) =>
          q.eq("status", "running").lt("leaseExpiresAt", args.now)
        )
        .take(50),
      ctx.db
        .query("webhookDelivery")
        .withIndex("by_status_and_receivedAt", (q) =>
          q
            .eq("status", "queued")
            .lt("receivedAt", args.now - QUEUED_RECOVERY_MS)
        )
        .take(50),
    ]);
    for (const row of running) {
      await ctx.db.patch("webhookDelivery", row._id, {
        status: "queued",
        leaseExpiresAt: undefined,
      });
    }
    for (const row of [...running, ...queued]) {
      await ctx.scheduler.runAfter(0, internal.github.project.project, {
        deliveryId: row.deliveryId,
      });
    }
    return running.length + queued.length;
  },
});
