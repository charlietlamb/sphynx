import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

/**
 * Record a delivery, returning whether it was newly inserted (idempotency on the
 * GitHub delivery id). A duplicate returns false so the caller stops.
 */
export const recordDelivery = internalMutation({
  args: {
    deliveryId: v.string(),
    eventType: v.string(),
    installationId: v.union(v.number(), v.null()),
    receivedAt: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("webhookDelivery")
      .withIndex("by_deliveryId", (q) => q.eq("deliveryId", args.deliveryId))
      .unique();
    if (existing !== null) {
      return false;
    }
    await ctx.db.insert("webhookDelivery", {
      deliveryId: args.deliveryId,
      eventType: args.eventType,
      installationId: args.installationId,
      receivedAt: args.receivedAt,
    });
    return true;
  },
});
