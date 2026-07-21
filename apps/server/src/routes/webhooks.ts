import { Effect } from "effect";
import { WebhookIngest } from "../github/webhook-ingest";

const WEBHOOK_PATH = "/api/github/webhooks";

export const isWebhookPath = (pathname: string) => pathname === WEBHOOK_PATH;

const respond = (status: number, body: string) =>
  new Response(body, {
    status,
    headers: { "content-type": "text/plain" },
  });

export const handleWebhook = (request: Request) =>
  Effect.gen(function* () {
    const ingest = yield* WebhookIngest;
    const body = new Uint8Array(
      yield* Effect.promise(() => request.arrayBuffer())
    );
    const outcome = yield* ingest.ingest({
      deliveryId: request.headers.get("x-github-delivery"),
      eventType: request.headers.get("x-github-event"),
      signature: request.headers.get("x-hub-signature-256"),
      body,
    });
    switch (outcome._tag) {
      case "Accepted":
        return respond(202, "accepted");
      case "Duplicate":
        return respond(202, "duplicate");
      case "Ping":
        return respond(204, "");
      default:
        return respond(401, outcome.reason);
    }
  });
