import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";
import { testModules as modules } from "../test.helpers";

const setup = () => convexTest(schema, modules);
type T = ReturnType<typeof setup>;

const NOW = 1_785_000_000_000;
const WINDOW_MS = 20 * 60 * 1000;

const addInstall = (
  t: T,
  installationId: number,
  reconciledAt: number | null = null
) =>
  t.run((ctx) =>
    ctx.db.insert("installation", { installationId, reconciledAt })
  );

const addDelivery = (t: T, installationId: number | null, receivedAt: number) =>
  t.run(async (ctx) => {
    await ctx.db.insert("webhookDelivery", {
      deliveryId: `d-${installationId}-${receivedAt}`,
      eventType: "pull_request",
      installationId,
      receivedAt,
    });
    if (installationId !== null) {
      const installation = await ctx.db
        .query("installation")
        .withIndex("by_installationId", (q) =>
          q.eq("installationId", installationId)
        )
        .unique();
      if (installation) {
        await ctx.db.patch("installation", installation._id, {
          lastProjectedAt: receivedAt,
        });
      }
    }
  });

const stale = (t: T) =>
  t.mutation(internal.github.reconcile.claimStaleInstallationIds, { now: NOW });

describe("claimStaleInstallationIds", () => {
  test("returns known installs with no recent webhook", async () => {
    const t = setup();
    await addInstall(t, 100);
    await addInstall(t, 200);
    expect((await stale(t)).sort()).toEqual([100, 200]);
  });

  test("skips an install with a webhook inside the window", async () => {
    const t = setup();
    await addInstall(t, 100);
    await addInstall(t, 200, NOW - 1000);
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
    await addInstall(t, 100, NOW - 1000);
    await addDelivery(t, 100, NOW - 1000);
    expect(await stale(t)).toEqual([]);
  });

  test("a recent webhook cannot defer a full reconcile past six hours", async () => {
    const t = setup();
    await addInstall(t, 100, NOW - 6 * 60 * 60 * 1000 - 1);
    await addDelivery(t, 100, NOW - 1000);
    expect(await stale(t)).toEqual([100]);
  });

  test("skips recently reconciled and retired installations", async () => {
    const t = setup();
    await t.run(async (ctx) => {
      await ctx.db.insert("installation", {
        installationId: 100,
        reconciledAt: NOW - 1000,
      });
      await ctx.db.insert("installation", {
        installationId: 200,
        reconciledAt: null,
        retiredAt: NOW - 1000,
      });
    });
    expect(await stale(t)).toEqual([]);
  });

  test("rotates beyond the first batch without starvation", async () => {
    const t = setup();
    for (let installationId = 1; installationId <= 101; installationId += 1) {
      await addInstall(t, installationId);
    }
    const first = await stale(t);
    const second = await stale(t);
    expect(first).toHaveLength(100);
    expect(new Set([...first, ...second])).toHaveLength(101);
  });
});
