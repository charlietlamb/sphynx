import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

const DELIVERY_TTL_MS = 48 * 60 * 60 * 1000;
const HISTORY_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const BATCH = 200;

/**
 * Retire rows nothing reads any more so three append-only tables don't grow
 * without bound. Runs one bounded batch and returns whether more remain, so the
 * caller (reconcile) can reschedule until drained — keeping each mutation well
 * under the document-write cap.
 *
 * - webhookDelivery: only the last ~20 min gate reconcile and dedup is
 *   idempotent past that; 48h matches GitHub's redelivery window.
 * - workbenchEvent: the feed only serves the newest ~100/repo.
 * - merged/closed reviewPull: the dashboard reads open pulls only; the rail
 *   rebuilds promotion history from GitHub.
 */
export const pruneOnce = internalMutation({
  args: { now: v.number() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const deliveryCutoff = args.now - DELIVERY_TTL_MS;
    const historyCutoff = args.now - HISTORY_TTL_MS;
    let more = false;

    const deliveries = await ctx.db
      .query("webhookDelivery")
      .withIndex("by_receivedAt", (q) => q.lt("receivedAt", deliveryCutoff))
      .take(BATCH);
    await Promise.all(deliveries.map((row) => ctx.db.delete(row._id)));
    more ||= deliveries.length === BATCH;

    const events = await ctx.db
      .query("workbenchEvent")
      .withIndex("by_occurredAt", (q) => q.lt("occurredAt", historyCutoff))
      .take(BATCH);
    await Promise.all(events.map((row) => ctx.db.delete(row._id)));
    more ||= events.length === BATCH;

    for (const state of ["merged", "closed"] as const) {
      const stale = await ctx.db
        .query("reviewPull")
        .withIndex("by_state_and_fetchedAt", (q) =>
          q.eq("state", state).lt("fetchedAt", historyCutoff),
        )
        .take(BATCH);
      await Promise.all(stale.map((row) => ctx.db.delete(row._id)));
      more ||= stale.length === BATCH;
    }

    return more;
  },
});
