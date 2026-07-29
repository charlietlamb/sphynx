import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";
import { testModules as modules } from "../test.helpers";

const setup = () => convexTest(schema, modules);
type T = ReturnType<typeof setup>;

const NOW = 1_785_000_000_000;
const WINDOW_MS = 20 * 60 * 1000;

const addInstall = (t: T, installationId: number) =>
  t.run((ctx) =>
    ctx.db.insert("installation", { installationId, reconciledAt: null }),
  );

const addDelivery = (t: T, installationId: number | null, receivedAt: number) =>
  t.run((ctx) =>
    ctx.db.insert("webhookDelivery", {
      deliveryId: `d-${installationId}-${receivedAt}`,
      eventType: "pull_request",
      installationId,
      receivedAt,
    }),
  );

const stale = (t: T) =>
  t.query(internal.github.reconcile.staleInstallationIds, { now: NOW });

describe("staleInstallationIds", () => {
  test("returns known installs with no recent webhook", async () => {
    const t = setup();
    await addInstall(t, 100);
    await addInstall(t, 200);
    expect((await stale(t)).sort()).toEqual([100, 200]);
  });

  test("skips an install with a webhook inside the window", async () => {
    const t = setup();
    await addInstall(t, 100);
    await addInstall(t, 200);
    await addDelivery(t, 200, NOW - WINDOW_MS / 2);
    expect(await stale(t)).toEqual([100]);
  });

  test("does not skip an install whose last webhook predates the window", async () => {
    const t = setup();
    await addInstall(t, 100);
    await addDelivery(t, 100, NOW - WINDOW_MS - 1);
    expect(await stale(t)).toEqual([100]);
  });

  test("a known install with no repos yet is still swept (wiped/new)", async () => {
    const t = setup();
    await addInstall(t, 100);
    expect(await stale(t)).toEqual([100]);
  });

  test("returns empty when every install is recently active", async () => {
    const t = setup();
    await addInstall(t, 100);
    await addDelivery(t, 100, NOW - 1000);
    expect(await stale(t)).toEqual([]);
  });
});
