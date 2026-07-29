import { v } from "convex/values";
import { internal } from "../_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "../_generated/server";

/**
 * An installation that received a webhook within this window is already fresh
 * via the projector, so reconcile skips it — the sweep only repairs the quiet
 * installs a missed delivery could have left stale.
 */
const RECENT_WEBHOOK_WINDOW_MS = 20 * 60 * 1000;
const MAX_RECONCILE_AGE_MS = 6 * 60 * 60 * 1000;
const CLEANUP_BATCH = 20;

/**
 * Register an installation as known so reconcile sweeps it, and stamp when it
 * was last reconciled. Idempotent — the first materialize and the installation
 * webhook both call it. Tracking known installs in their own table (not deriving
 * from the read model) means a wiped or brand-new install stays reconcilable.
 */
export const markInstallation = internalMutation({
  args: { installationId: v.number(), reconciledAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("installation")
      .withIndex("by_installationId", (q) =>
        q.eq("installationId", args.installationId)
      )
      .unique();
    if (existing === null) {
      await ctx.db.insert("installation", {
        installationId: args.installationId,
        reconciledAt: args.reconciledAt,
        reconcileAttemptedAt: args.reconciledAt,
      });
      return null;
    }
    await ctx.db.patch("installation", existing._id, {
      reconciledAt: args.reconciledAt,
      reconcileAttemptedAt: args.reconciledAt,
    });
    return null;
  },
});

export const isRetired = internalQuery({
  args: { installationId: v.number() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("installation")
      .withIndex("by_installationId", (q) =>
        q.eq("installationId", args.installationId)
      )
      .unique();
    return row?.retiredAt !== undefined;
  },
});

export const restoreInstallation = internalMutation({
  args: { installationId: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("installation")
      .withIndex("by_installationId", (q) =>
        q.eq("installationId", args.installationId)
      )
      .unique();
    if (row) {
      await ctx.db.patch("installation", row._id, { retiredAt: undefined });
    } else {
      await ctx.db.insert("installation", {
        installationId: args.installationId,
        reconciledAt: null,
      });
    }
    return null;
  },
});

export const retireInstallation = internalMutation({
  args: { installationId: v.number(), retiredAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("installation")
      .withIndex("by_installationId", (q) =>
        q.eq("installationId", args.installationId)
      )
      .unique();
    if (row) {
      await ctx.db.patch("installation", row._id, {
        retiredAt: args.retiredAt,
      });
    } else {
      await ctx.db.insert("installation", {
        installationId: args.installationId,
        reconciledAt: null,
        retiredAt: args.retiredAt,
      });
    }
    const token = await ctx.db
      .query("installationToken")
      .withIndex("by_installationId", (q) =>
        q.eq("installationId", args.installationId)
      )
      .unique();
    const lease = await ctx.db
      .query("materializationLease")
      .withIndex("by_installation", (q) =>
        q.eq("installationId", args.installationId)
      )
      .unique();
    await Promise.all([
      ...(token ? [ctx.db.delete("installationToken", token._id)] : []),
      ...(lease ? [ctx.db.delete("materializationLease", lease._id)] : []),
    ]);
    await ctx.scheduler.runAfter(
      0,
      internal.github.reconcile.cleanupRetiredInstallation,
      { installationId: args.installationId }
    );
    return null;
  },
});

export const cleanupRetiredInstallation = internalMutation({
  args: { installationId: v.number() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const installation = await ctx.db
      .query("installation")
      .withIndex("by_installationId", (q) =>
        q.eq("installationId", args.installationId)
      )
      .unique();
    if (installation?.retiredAt === undefined) {
      return false;
    }
    const [repos, gaps, heads, events, refreshes, ...pullGroups] =
      await Promise.all([
        ctx.db
          .query("reviewRepo")
          .withIndex("by_installation", (q) =>
            q.eq("installationId", args.installationId)
          )
          .take(CLEANUP_BATCH),
        ctx.db
          .query("stageGap")
          .withIndex("by_installation", (q) =>
            q.eq("installationId", args.installationId)
          )
          .take(CLEANUP_BATCH),
        ctx.db
          .query("pullHead")
          .withIndex("by_installation_and_owner_and_repo_and_number", (q) =>
            q.eq("installationId", args.installationId)
          )
          .take(CLEANUP_BATCH),
        ctx.db
          .query("workbenchEvent")
          .withIndex("by_installation_and_repo_and_occurredAt", (q) =>
            q.eq("installationId", args.installationId)
          )
          .take(CLEANUP_BATCH),
        ctx.db
          .query("pullRefresh")
          .withIndex("by_installation", (q) =>
            q.eq("installationId", args.installationId)
          )
          .take(CLEANUP_BATCH),
        ...(["open", "merged", "closed"] as const).map((state) =>
          ctx.db
            .query("reviewPull")
            .withIndex("by_installation_and_state", (q) =>
              q.eq("installationId", args.installationId).eq("state", state)
            )
            .take(CLEANUP_BATCH)
        ),
      ]);
    const deletions = [
      ...repos.map((row) => ctx.db.delete("reviewRepo", row._id)),
      ...gaps.map((row) => ctx.db.delete("stageGap", row._id)),
      ...heads.map((row) => ctx.db.delete("pullHead", row._id)),
      ...events.map((row) => ctx.db.delete("workbenchEvent", row._id)),
      ...refreshes.map((row) => ctx.db.delete("pullRefresh", row._id)),
      ...pullGroups.flat().map((row) => ctx.db.delete("reviewPull", row._id)),
    ];
    await Promise.all(deletions);
    if (deletions.length > 0) {
      await ctx.scheduler.runAfter(
        0,
        internal.github.reconcile.cleanupRetiredInstallation,
        args
      );
    }
    return deletions.length > 0;
  },
});

/**
 * Installations reconcile should sweep: every known installation except those
 * that received a webhook within the recent window. Known installs come from
 * the installation table, ordered by oldest attempt and bounded per sweep.
 * Every claimed row advances even when a recent webhook lets us skip it, so a
 * hot or failing installation cannot starve the rest.
 */
export const claimStaleInstallationIds = internalMutation({
  args: { now: v.number() },
  returns: v.array(v.number()),
  handler: async (ctx, args) => {
    const cutoff = args.now - RECENT_WEBHOOK_WINDOW_MS;
    const fullReconcileCutoff = args.now - MAX_RECONCILE_AGE_MS;
    const installs = await ctx.db
      .query("installation")
      .withIndex("by_reconcileAttemptedAt")
      .order("asc")
      .take(100);
    await Promise.all(
      installs.map((row) =>
        ctx.db.patch("installation", row._id, {
          reconcileAttemptedAt: args.now,
        })
      )
    );
    return installs
      .filter(
        (row) =>
          row.retiredAt === undefined &&
          ((row.reconciledAt ?? 0) < fullReconcileCutoff ||
            Math.max(row.reconciledAt ?? 0, row.lastProjectedAt ?? 0) < cutoff)
      )
      .map((row) => row.installationId);
  },
});

/**
 * The reconcile backstop. Webhooks are the real-time freshness path; reconcile
 * repairs drift from missed or out-of-order deliveries. No leader election —
 * Convex crons run once globally. Prunes, then re-materializes each stale
 * installation (seed=false: webhooks already stream feed events, so re-pulling
 * the Events API every sweep is waste). Each install builds independently via a
 * scheduled action so one slow install does not block the rest.
 */
export const reconcile = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    await ctx.runMutation(internal.github.prune.pruneOnce, { now });
    await ctx.runMutation(internal.github.ingest.requeueExpiredDeliveries, {
      now,
    });
    const ids = await ctx.runMutation(
      internal.github.reconcile.claimStaleInstallationIds,
      { now }
    );
    for (const installationId of ids) {
      await ctx.scheduler.runAfter(0, internal.github.materialize.materialize, {
        installationId,
        seed: false,
      });
    }
    return null;
  },
});
