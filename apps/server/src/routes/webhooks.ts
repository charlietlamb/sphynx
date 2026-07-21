import { Effect } from "effect";
import { WebhookIngest } from "../github/webhook-ingest";
import { WebhookProjector } from "../github/webhook-projector";

const WEBHOOK_PATH = "/api/github/webhooks";

export const isWebhookPath = (pathname: string) => pathname === WEBHOOK_PATH;

const respond = (status: number, body: string) =>
  new Response(body, {
    status,
    headers: { "content-type": "text/plain" },
  });

const parsePayload = (body: Uint8Array): unknown => {
  try {
    return JSON.parse(Buffer.from(body).toString("utf8"));
  } catch {
    return null;
  }
};

export const handleWebhook = (request: Request) =>
  Effect.gen(function* () {
    const ingest = yield* WebhookIngest;
    const projector = yield* WebhookProjector;
    const eventType = request.headers.get("x-github-event");
    const body = new Uint8Array(
      yield* Effect.promise(() => request.arrayBuffer())
    );
    const outcome = yield* ingest.ingest({
      deliveryId: request.headers.get("x-github-delivery"),
      eventType,
      signature: request.headers.get("x-hub-signature-256"),
      body,
    });
    switch (outcome._tag) {
      case "Accepted":
        yield* projector
          .project(eventType ?? "", outcome.deliveryId, parsePayload(body))
          .pipe(Effect.forkDaemon);
        return respond(202, "accepted");
      case "Duplicate":
        return respond(202, "duplicate");
      case "Ping":
        return respond(204, "");
      default:
        return respond(401, outcome.reason);
    }
  });
