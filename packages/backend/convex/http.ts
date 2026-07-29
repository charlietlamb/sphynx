import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();
const MAX_WEBHOOK_BYTES = 3 * 1024 * 1024;

authComponent.registerRoutes(http, createAuth);

async function readWebhookBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) {
    return "";
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    size += value.byteLength;
    if (size > MAX_WEBHOOK_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

/**
 * GitHub webhook receiver. Reads the raw body (for HMAC), verifies + dedups +
 * schedules projection in a Node action, and answers fast: 202 accepted /
 * duplicate, 204 ping, 401 bad signature.
 */
http.route({
  path: "/github/webhooks",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (declared > MAX_WEBHOOK_BYTES) {
      return new Response("payload too large", { status: 413 });
    }
    const body = await readWebhookBody(request);
    if (body === null) {
      return new Response("payload too large", { status: 413 });
    }
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
    if (outcome === "invalid") {
      return new Response("invalid payload", { status: 400 });
    }
    return new Response(outcome, { status: 202 });
  }),
});

export default http;
