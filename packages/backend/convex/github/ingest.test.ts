import { createHmac } from "node:crypto";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";
import { testModules as modules } from "../test.helpers";
import { verifySignature } from "./verifyWebhook";

const setup = () => convexTest(schema, modules);

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
      installationId: 990_001,
      receivedAt: 1_700_000_000_000,
    };
    expect(await t.mutation(internal.github.ingest.recordDelivery, args)).toBe(
      true,
    );
    expect(await t.mutation(internal.github.ingest.recordDelivery, args)).toBe(
      false,
    );
  });
});
