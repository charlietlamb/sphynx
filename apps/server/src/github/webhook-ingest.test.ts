import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { Database } from "@sphynx/db/client";
import { Duration, Effect, Layer, Redacted } from "effect";
import { GitHubConfig } from "./config";
import {
  WebhookIngest,
  WebhookIngestLive,
  type WebhookOutcome,
} from "./webhook-ingest";

const SECRET = "primary-secret";
const ROTATED = "previous-secret";

const configWith = (secrets: string[]) =>
  Layer.succeed(GitHubConfig, {
    apiUrl: "https://api.github.test",
    apiVersion: "2022-11-28",
    timeout: Duration.seconds(1),
    webhookSecrets: secrets.map(Redacted.make),
    app: {
      appId: "1",
      clientId: "Iv1.test",
      privateKey: Redacted.make("test-key"),
    },
  });

const seen = new Set<string>();

const insertDelivery = (deliveryId: string) => {
  if (seen.has(deliveryId)) {
    return [];
  }
  seen.add(deliveryId);
  return [{ deliveryId }];
};

const stubDb = Layer.succeed(Database, {
  insert: () => ({
    values: (row: { deliveryId: string }) => ({
      onConflictDoNothing: () => ({
        returning: () => Promise.resolve(insertDelivery(row.deliveryId)),
      }),
    }),
  }),
} as unknown as typeof Database.Service);

const sign = (secret: string, body: string) =>
  `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

const bodyFor = (installationId: number) =>
  JSON.stringify({ action: "opened", installation: { id: installationId } });

const run = (
  secrets: string[],
  request: {
    deliveryId: string | null;
    eventType: string | null;
    signature: string | null;
    body: string;
  }
): Promise<WebhookOutcome> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const ingest = yield* WebhookIngest;
      return yield* ingest.ingest({
        deliveryId: request.deliveryId,
        eventType: request.eventType,
        signature: request.signature,
        body: new TextEncoder().encode(request.body),
      });
    }).pipe(
      Effect.provide(
        WebhookIngestLive.pipe(
          Layer.provide(Layer.merge(configWith(secrets), stubDb))
        )
      )
    )
  );

describe("WebhookIngest.ingest", () => {
  test("accepts a correctly signed delivery", async () => {
    const body = bodyFor(147_820_429);
    const outcome = await run([SECRET], {
      deliveryId: "d-accept-1",
      eventType: "pull_request",
      signature: sign(SECRET, body),
      body,
    });
    expect(outcome._tag).toBe("Accepted");
  });

  test("rejects a tampered body", async () => {
    const body = bodyFor(1);
    const outcome = await run([SECRET], {
      deliveryId: "d-tamper-1",
      eventType: "pull_request",
      signature: sign(SECRET, body),
      body: `${body} `,
    });
    expect(outcome._tag).toBe("Rejected");
  });

  test("rejects a wrong secret", async () => {
    const body = bodyFor(1);
    const outcome = await run([SECRET], {
      deliveryId: "d-wrong-1",
      eventType: "pull_request",
      signature: sign("attacker", body),
      body,
    });
    expect(outcome._tag).toBe("Rejected");
  });

  test("accepts a signature from the rotated (previous) secret", async () => {
    const body = bodyFor(1);
    const outcome = await run([SECRET, ROTATED], {
      deliveryId: "d-rotate-1",
      eventType: "pull_request",
      signature: sign(ROTATED, body),
      body,
    });
    expect(outcome._tag).toBe("Accepted");
  });

  test("short-circuits a signed ping with Ping", async () => {
    const body = JSON.stringify({ zen: "awesome", hook_id: 1 });
    const outcome = await run([SECRET], {
      deliveryId: "d-ping-1",
      eventType: "ping",
      signature: sign(SECRET, body),
      body,
    });
    expect(outcome._tag).toBe("Ping");
  });

  test("rejects when no secret is configured", async () => {
    const body = bodyFor(1);
    const outcome = await run([], {
      deliveryId: "d-nosecret-1",
      eventType: "pull_request",
      signature: sign(SECRET, body),
      body,
    });
    expect(outcome._tag).toBe("Rejected");
  });

  test("dedupes a redelivered id", async () => {
    const body = bodyFor(1);
    const request = {
      deliveryId: "d-dupe-1",
      eventType: "pull_request",
      signature: sign(SECRET, body),
      body,
    };
    const first = await run([SECRET], request);
    const second = await run([SECRET], request);
    expect(first._tag).toBe("Accepted");
    expect(second._tag).toBe("Duplicate");
  });
});
