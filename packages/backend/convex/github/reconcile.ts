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
        q.eq("installationId", args.installationId),
      )
      .unique();
    if (existing === null) {
      await ctx.db.insert("installation", {
        installationId: args.installationId,
        reconciledAt: args.reconciledAt,
      });
      return null;
    }
    await ctx.db.patch(existing._id, { reconciledAt: args.reconciledAt });
    return null;
  },
});

/**
 * Installations reconcile should sweep: every known installation except those
 * that received a webhook within the recent window. Known installs come from
 * the installation table (registered at first materialize or install webhook),
 * so a wiped read model is still repaired. Convex has no correlated NOT-IN, so
 * the two sets are diffed in JS.
 */
export const staleInstallationIds = internalQuery({
  args: { now: v.number() },
  returns: v.array(v.number()),
  handler: async (ctx, args) => {
    const cutoff = args.now - RECENT_WEBHOOK_WINDOW_MS;
    const installs = await ctx.db.query("installation").collect();
    const known = new Set(installs.map((row) => row.installationId));

    const recent = await ctx.db
      .query("webhookDelivery")
      .withIndex("by_receivedAt", (q) => q.gt("receivedAt", cutoff))
      .collect();
    for (const delivery of recent) {
      if (delivery.installationId !== null) {
        known.delete(delivery.installationId);
      }
    }
    return [...known];
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
    let more = true;
    while (more) {
      more = await ctx.runMutation(internal.github.prune.pruneOnce, { now });
    }
    const ids = await ctx.runQuery(
      internal.github.reconcile.staleInstallationIds,
      { now },
    );
    for (const installationId of ids) {
      await ctx.scheduler.runAfter(
        0,
        internal.github.materialize.materialize,
        { installationId, now, seed: false },
      );
    }
    return null;
  },
});
