import { createHmac } from "node:crypto";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";
import { testModules as modules } from "../test.helpers";
import { verifySignature } from "./verifyWebhook";

const setup = () => convexTest(schema, modules);

const deliveryStatus = (t: ReturnType<typeof setup>, deliveryId: string) =>
  t.run(async (ctx) => {
    const row = await ctx.db
      .query("webhookDelivery")
      .withIndex("by_deliveryId", (q) => q.eq("deliveryId", deliveryId))
      .unique();
    return row
      ? {
          status: row.status ?? null,
          attempts: row.attempts ?? 0,
          lastError: row.lastError ?? null,
        }
      : null;
  });

const sign = (secret: string, body: string) =>
  `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

describe("verifySignature", () => {
  const SECRET = "top-secret";
  const body = JSON.stringify({ action: "opened", number: 1 });

  test("accepts a correct signature", () => {
    process.env.GITHUB_WEBHOOK_SECRET = SECRET;
    process.env.GITHUB_WEBHOOK_SECRET_PREVIOUS = "";
    expect(verifySignature(body, sign(SECRET, body))).toBe(true);
  });

  test("rejects a signature made with the wrong secret", () => {
    process.env.GITHUB_WEBHOOK_SECRET = SECRET;
    expect(verifySignature(body, sign("other-secret", body))).toBe(false);
  });

  test("rejects a tampered body", () => {
    process.env.GITHUB_WEBHOOK_SECRET = SECRET;
    expect(verifySignature(`${body} `, sign(SECRET, body))).toBe(false);
  });

  test("rejects a missing or malformed signature", () => {
    process.env.GITHUB_WEBHOOK_SECRET = SECRET;
    expect(verifySignature(body, null)).toBe(false);
    expect(verifySignature(body, "not-a-sig")).toBe(false);
    expect(verifySignature(body, "sha256=")).toBe(false);
  });

  test("accepts the previous secret during rotation", () => {
    process.env.GITHUB_WEBHOOK_SECRET = "new-secret";
    process.env.GITHUB_WEBHOOK_SECRET_PREVIOUS = "old-secret";
    expect(verifySignature(body, sign("old-secret", body))).toBe(true);
    expect(verifySignature(body, sign("new-secret", body))).toBe(true);
  });

  test("rejects when no secret is configured", () => {
    process.env.GITHUB_WEBHOOK_SECRET = "";
    process.env.GITHUB_WEBHOOK_SECRET_PREVIOUS = "";
    expect(verifySignature(body, sign(SECRET, body))).toBe(false);
  });
});

describe("recordDelivery dedup", () => {
  test("a new delivery inserts, a repeat is a no-op", async () => {
    const t = setup();
    const args = {
      deliveryId: "d-1",
      eventType: "pull_request",
      receivedAt: 1_700_000_000_000,
      job: {
        installationId: 990_001,
        projection: { kind: "none" as const },
        status: null,
        headClose: null,
        headMove: null,
        workbench: null,
      },
    };
    expect(await t.mutation(internal.github.ingest.recordDelivery, args)).toBe(
      true
    );
    expect(await t.mutation(internal.github.ingest.recordDelivery, args)).toBe(
      false
    );
    const scheduled = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").take(10)
    );
    expect(scheduled).toHaveLength(1);
  });

  test("a legacy delivery is upgraded to a durable job", async () => {
    const t = setup();
    await t.run((ctx) =>
      ctx.db.insert("webhookDelivery", {
        deliveryId: "legacy",
        eventType: "pull_request",
        installationId: 990_001,
        receivedAt: 1,
      })
    );
    expect(
      await t.mutation(internal.github.ingest.recordDelivery, {
        deliveryId: "legacy",
        eventType: "pull_request",
        receivedAt: 2,
        job: {
          installationId: 990_001,
          projection: { kind: "none" },
          status: null,
          headClose: null,
          headMove: null,
          workbench: null,
        },
      })
    ).toBe(true);
    expect(await deliveryStatus(t, "legacy")).toMatchObject({
      status: "queued",
      attempts: 0,
    });
  });

  test("claims, retries, and completes a durable delivery", async () => {
    const t = setup();
    const deliveryId = "d-lifecycle";
    await t.mutation(internal.github.ingest.recordDelivery, {
      deliveryId,
      eventType: "pull_request",
      receivedAt: 100,
      job: {
        installationId: 990_002,
        projection: { kind: "none" as const },
        status: null,
        headClose: null,
        headMove: null,
        workbench: null,
      },
    });

    expect(await deliveryStatus(t, deliveryId)).toMatchObject({
      status: "queued",
      attempts: 0,
    });
    expect(
      await t.mutation(internal.github.ingest.claimDelivery, {
        deliveryId,
        now: 200,
      })
    ).toMatchObject({ attempt: 1 });
    await t.mutation(internal.github.ingest.retryDelivery, {
      deliveryId,
      attempt: 1,
      error: "temporary",
    });
    expect(await deliveryStatus(t, deliveryId)).toMatchObject({
      status: "queued",
      attempts: 1,
      lastError: "temporary",
    });

    expect(
      await t.mutation(internal.github.ingest.claimDelivery, {
        deliveryId,
        now: 300,
      })
    ).toMatchObject({ attempt: 2 });
    await t.mutation(internal.github.ingest.completeDelivery, {
      deliveryId,
      attempt: 2,
      syncedAt: 400,
    });

    expect(await deliveryStatus(t, deliveryId)).toMatchObject({
      status: "succeeded",
      attempts: 2,
      lastError: null,
    });
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("installation")
          .withIndex("by_installationId", (q) =>
            q.eq("installationId", 990_002)
          )
          .unique()
      )
    ).toMatchObject({ lastProjectedAt: 400 });
  });

  test("an expired worker cannot finish a replacement's attempt", async () => {
    const t = setup();
    const deliveryId = "d-stale";
    await t.mutation(internal.github.ingest.recordDelivery, {
      deliveryId,
      eventType: "push",
      receivedAt: 100,
      job: {
        installationId: null,
        projection: { kind: "none" as const },
        status: null,
        headClose: null,
        headMove: null,
        workbench: null,
      },
    });
    await t.mutation(internal.github.ingest.claimDelivery, {
      deliveryId,
      now: 200,
    });
    await t.mutation(internal.github.ingest.claimDelivery, {
      deliveryId,
      now: 200 + 2 * 60_000 + 1,
    });
    expect(
      await t.mutation(internal.github.ingest.completeDelivery, {
        deliveryId,
        attempt: 1,
        syncedAt: null,
      })
    ).toBe(false);
    await t.mutation(internal.github.ingest.retryDelivery, {
      deliveryId,
      attempt: 1,
      error: "stale",
    });
    expect(await deliveryStatus(t, deliveryId)).toMatchObject({
      status: "running",
      attempts: 2,
    });
  });

  test("requeues a delivery whose first scheduled action never claimed", async () => {
    const t = setup();
    await t.run((ctx) =>
      ctx.db.insert("webhookDelivery", {
        deliveryId: "d-queued",
        eventType: "push",
        installationId: null,
        receivedAt: 1,
        job: {
          installationId: null,
          projection: { kind: "none" },
          status: null,
          headClose: null,
          headMove: null,
          workbench: null,
        },
        status: "queued",
        attempts: 0,
      })
    );
    expect(
      await t.mutation(internal.github.ingest.requeueExpiredDeliveries, {
        now: 3 * 60_000,
      })
    ).toBe(1);
    expect(
      await t.run((ctx) => ctx.db.system.query("_scheduled_functions").take(10))
    ).toHaveLength(1);
  });
});
