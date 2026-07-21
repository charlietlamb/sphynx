import { createHmac, timingSafeEqual } from "node:crypto";
import { Database } from "@sphynx/db/client";
import { webhookDelivery } from "@sphynx/db/schema";
import { Clock, Context, Effect, Layer, Redacted } from "effect";
import { GitHubConfig } from "./config";

const SIGNATURE_PREFIX = "sha256=";

export type WebhookOutcome =
  | { readonly _tag: "Accepted"; readonly deliveryId: string }
  | { readonly _tag: "Duplicate"; readonly deliveryId: string }
  | { readonly _tag: "Rejected"; readonly reason: string }
  | { readonly _tag: "Ping" };

interface WebhookRequest {
  readonly body: Uint8Array;
  readonly deliveryId: string | null;
  readonly eventType: string | null;
  readonly signature: string | null;
}

const signatureMatches = (
  secrets: readonly Redacted.Redacted<string>[],
  body: Uint8Array,
  signature: string
) => {
  if (!signature.startsWith(SIGNATURE_PREFIX)) {
    return false;
  }
  const provided = Uint8Array.from(
    Buffer.from(signature.slice(SIGNATURE_PREFIX.length), "hex")
  );
  if (provided.length === 0) {
    return false;
  }
  return secrets.some((secret) => {
    const expected = Uint8Array.from(
      createHmac("sha256", Redacted.value(secret)).update(body).digest()
    );
    return (
      expected.length === provided.length && timingSafeEqual(expected, provided)
    );
  });
};

const installationIdFrom = (body: Uint8Array): number | null => {
  try {
    const payload = JSON.parse(Buffer.from(body).toString("utf8")) as {
      installation?: { id?: number };
    };
    return payload.installation?.id ?? null;
  } catch {
    return null;
  }
};

const makeWebhookIngest = Effect.gen(function* () {
  const config = yield* GitHubConfig;
  const db = yield* Database;

  const recordDelivery = (
    deliveryId: string,
    eventType: string,
    installationId: number | null,
    receivedAt: Date
  ) =>
    Effect.tryPromise(() =>
      db
        .insert(webhookDelivery)
        .values({ deliveryId, eventType, installationId, receivedAt })
        .onConflictDoNothing()
        .returning({ deliveryId: webhookDelivery.deliveryId })
    ).pipe(Effect.orDie);

  const ingest = (request: WebhookRequest): Effect.Effect<WebhookOutcome> =>
    Effect.gen(function* () {
      if (config.webhookSecrets.length === 0) {
        return yield* Effect.logError(
          "webhook received but GITHUB_WEBHOOK_SECRET is unset"
        ).pipe(
          Effect.as({
            _tag: "Rejected" as const,
            reason: "secret unconfigured",
          })
        );
      }
      if (
        !(
          request.signature &&
          signatureMatches(
            config.webhookSecrets,
            request.body,
            request.signature
          )
        )
      ) {
        return { _tag: "Rejected" as const, reason: "invalid signature" };
      }
      if (request.eventType === "ping") {
        return { _tag: "Ping" as const };
      }
      if (!(request.deliveryId && request.eventType)) {
        return {
          _tag: "Rejected" as const,
          reason: "missing delivery headers",
        };
      }
      const installationId = installationIdFrom(request.body);
      const receivedAt = new Date(yield* Clock.currentTimeMillis);
      const inserted = yield* recordDelivery(
        request.deliveryId,
        request.eventType,
        installationId,
        receivedAt
      );
      if (inserted.length === 0) {
        return { _tag: "Duplicate" as const, deliveryId: request.deliveryId };
      }
      return { _tag: "Accepted" as const, deliveryId: request.deliveryId };
    }).pipe(
      Effect.withSpan("WebhookIngest.ingest"),
      Effect.annotateLogs({
        "github.delivery": request.deliveryId ?? "unknown",
        "github.event": request.eventType ?? "unknown",
      })
    );

  return { ingest };
});

export class WebhookIngest extends Context.Tag("@sphynx/server/WebhookIngest")<
  WebhookIngest,
  Effect.Effect.Success<typeof makeWebhookIngest>
>() {}

export const WebhookIngestLive = Layer.effect(WebhookIngest, makeWebhookIngest);
