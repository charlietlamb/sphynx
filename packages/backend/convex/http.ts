import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

/**
 * GitHub webhook receiver. Reads the raw body (for HMAC), verifies + dedups +
 * schedules projection in a Node action, and answers fast: 202 accepted /
 * duplicate, 204 ping, 401 bad signature.
 */
http.route({
  path: "/github/webhooks",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    const outcome = await ctx.runAction(internal.github.webhook.ingestWebhook, {
      body,
      signature: request.headers.get("X-Hub-Signature-256"),
      eventType: request.headers.get("X-GitHub-Event"),
      deliveryId: request.headers.get("X-GitHub-Delivery"),
      now: Date.now(),
    });
    if (outcome === "rejected") {
      return new Response("invalid signature", { status: 401 });
    }
    if (outcome === "ping") {
      return new Response(null, { status: 204 });
    }
    return new Response(outcome, { status: 202 });
  }),
});

export default http;
