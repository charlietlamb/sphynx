"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { verifySignature } from "./verifyWebhook";

function parsePayload(
  body: string,
): { installation?: { id?: number } } & Record<string, unknown> {
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

/**
 * Verify + dedup a webhook, then schedule projection. Returns the outcome so the
 * HTTP route can answer GitHub fast (202 accepted/duplicate, 204 ping, 401 bad
 * signature). Projection runs detached via the scheduler — GitHub only needs the
 * ack; a projection failure never reaches it (reconcile is the repair path).
 */
export const ingestWebhook = internalAction({
  args: {
    body: v.string(),
    signature: v.union(v.string(), v.null()),
    eventType: v.union(v.string(), v.null()),
    deliveryId: v.union(v.string(), v.null()),
    now: v.number(),
  },
  returns: v.union(
    v.literal("accepted"),
    v.literal("duplicate"),
    v.literal("ping"),
    v.literal("rejected"),
  ),
  handler: async (ctx, args) => {
    if (!verifySignature(args.body, args.signature)) {
      return "rejected";
    }
    if (args.eventType === "ping") {
      return "ping";
    }
    if (!(args.deliveryId && args.eventType)) {
      return "rejected";
    }
    const payload = parsePayload(args.body);
    const inserted = await ctx.runMutation(
      internal.github.ingest.recordDelivery,
      {
        deliveryId: args.deliveryId,
        eventType: args.eventType,
        installationId: payload.installation?.id ?? null,
        receivedAt: args.now,
      },
    );
    if (!inserted) {
      return "duplicate";
    }
    await ctx.scheduler.runAfter(0, internal.github.project.project, {
      eventType: args.eventType,
      deliveryId: args.deliveryId,
      payload,
      now: args.now,
    });
    return "accepted";
  },
});
