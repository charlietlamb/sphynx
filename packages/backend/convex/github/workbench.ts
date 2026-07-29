import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

const workbenchEventInput = v.object({
  eventId: v.string(),
  installationId: v.number(),
  owner: v.string(),
  repo: v.string(),
  kind: v.string(),
  actor: v.union(v.string(), v.null()),
  actorAvatarUrl: v.union(v.string(), v.null()),
  pullNumber: v.union(v.number(), v.null()),
  title: v.union(v.string(), v.null()),
  detail: v.union(v.string(), v.null()),
  url: v.union(v.string(), v.null()),
  occurredAt: v.number(),
});

/**
 * Append workbench feed events, idempotent on the delivery-scoped eventId, so a
 * webhook redelivery or an overlapping seed is a no-op. Reactive queries repaint
 * the feed — no notify needed.
 */
export const writeWorkbenchEvents = internalMutation({
  args: { events: v.array(workbenchEventInput) },
  returns: v.number(),
  handler: async (ctx, args) => {
    let inserted = 0;
    for (const event of args.events) {
      const existing = await ctx.db
        .query("workbenchEvent")
        .withIndex("by_eventId", (q) => q.eq("eventId", event.eventId))
        .unique();
      if (existing === null) {
        await ctx.db.insert("workbenchEvent", event);
        inserted += 1;
      }
    }
    return inserted;
  },
});
