import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";

const DELIVERY_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const HISTORY_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RATE_LIMIT_TTL_MS = 24 * 60 * 60 * 1000;
const BATCH = 25;

/**
 * Retire rows nothing reads any more so three append-only tables don't grow
 * without bound. Runs one bounded batch and returns whether more remain, so the
 * caller (reconcile) can reschedule until drained — keeping each mutation well
 * under the document-write cap.
 *
 * - webhookDelivery: seven days covers GitHub's redelivery window.
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
    const rateLimitCutoff = args.now - RATE_LIMIT_TTL_MS;
    let more = false;

    const deliveries = await ctx.db
      .query("webhookDelivery")
      .withIndex("by_receivedAt", (q) => q.lt("receivedAt", deliveryCutoff))
      .take(BATCH);
    await Promise.all(
      deliveries.map((row) => ctx.db.delete("webhookDelivery", row._id))
    );
    more ||= deliveries.length === BATCH;

    const events = await ctx.db
      .query("workbenchEvent")
      .withIndex("by_occurredAt", (q) => q.lt("occurredAt", historyCutoff))
      .take(BATCH);
    await Promise.all(
      events.map((row) => ctx.db.delete("workbenchEvent", row._id))
    );
    more ||= events.length === BATCH;

    for (const state of ["merged", "closed"] as const) {
      const stale = await ctx.db
        .query("reviewPull")
        .withIndex("by_state_and_fetchedAt", (q) =>
          q.eq("state", state).lt("fetchedAt", historyCutoff)
        )
        .take(BATCH);
      await Promise.all(
        stale.map((row) => ctx.db.delete("reviewPull", row._id))
      );
      more ||= stale.length === BATCH;
    }

    const [tokens, refreshes, materializations, rateLimits] = await Promise.all(
      [
        ctx.db
          .query("installationToken")
          .withIndex("by_expiresAt", (q) => q.lt("expiresAt", args.now))
          .take(BATCH),
        ctx.db
          .query("pullRefresh")
          .withIndex("by_leaseExpiresAt", (q) =>
            q.lt("leaseExpiresAt", args.now)
          )
          .take(BATCH),
        ctx.db
          .query("materializationLease")
          .withIndex("by_leaseExpiresAt", (q) =>
            q.lt("leaseExpiresAt", args.now)
          )
          .take(BATCH),
        ctx.db
          .query("rateLimit")
          .withIndex("by_windowStartedAt", (q) =>
            q.lt("windowStartedAt", rateLimitCutoff)
          )
          .take(BATCH),
      ]
    );
    await Promise.all([
      ...tokens.map((row) => ctx.db.delete("installationToken", row._id)),
      ...refreshes.map((row) => ctx.db.delete("pullRefresh", row._id)),
      ...materializations.map((row) =>
        ctx.db.delete("materializationLease", row._id)
      ),
      ...rateLimits.map((row) => ctx.db.delete("rateLimit", row._id)),
    ]);
    await Promise.all([
      ...refreshes.map((row) =>
        ctx.scheduler.runAfter(0, internal.github.project.refreshPull, {
          installationId: row.installationId,
          owner: row.owner,
          repo: row.repo,
          number: row.number,
        })
      ),
      ...materializations.map((row) =>
        ctx.scheduler.runAfter(0, internal.github.materialize.materialize, {
          installationId: row.installationId,
          seed: row.seedRequested ?? false,
        })
      ),
    ]);
    more ||= [tokens, refreshes, materializations, rateLimits].some(
      (rows) => rows.length === BATCH
    );

    if (more) {
      await ctx.scheduler.runAfter(0, internal.github.prune.pruneOnce, {
        now: args.now,
      });
    }
    return more;
  },
});
