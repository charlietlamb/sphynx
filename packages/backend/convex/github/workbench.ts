import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { isInstallationRetired } from "./installationState";
import { workbenchEventInput } from "./validators";

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
    const retired = new Map<number, boolean>();
    for (const event of args.events) {
      if (!retired.has(event.installationId)) {
        retired.set(
          event.installationId,
          await isInstallationRetired(ctx, event.installationId)
        );
      }
      if (retired.get(event.installationId)) {
        continue;
      }
      const existing = await ctx.db
        .query("workbenchEvent")
        .withIndex("by_eventId", (q) => q.eq("eventId", event.eventId))
        .unique();
      if (existing === null) {
        await ctx.db.insert("workbenchEvent", {
          ...event,
          owner: event.owner.toLowerCase(),
          repo: event.repo.toLowerCase(),
        });
        inserted += 1;
      }
    }
    return inserted;
  },
});
