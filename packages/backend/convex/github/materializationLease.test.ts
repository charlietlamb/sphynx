import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";
import { testModules as modules } from "../test.helpers";

describe("materialization lease ownership", () => {
  test("an expired runner cannot complete its replacement's lease", async () => {
    const t = convexTest(schema, modules);
    const installationId = 990_003;

    expect(
      await t.mutation(internal.github.materializationLease.claim, {
        installationId,
        now: 0,
        runId: "first",
        seed: false,
      })
    ).toBe("run");
    expect(
      await t.mutation(internal.github.materializationLease.claim, {
        installationId,
        now: 1,
        runId: "queued",
        seed: false,
      })
    ).toBe("queued");
    expect(
      await t.mutation(internal.github.materializationLease.claim, {
        installationId,
        now: 10 * 60 * 1000,
        runId: "replacement",
        seed: false,
      })
    ).toBe("run");
    expect(
      await t.mutation(internal.github.materializationLease.complete, {
        installationId,
        now: 10 * 60 * 1000,
        runId: "first",
      })
    ).toBe("lost");
    expect(
      await t.mutation(internal.github.materializationLease.complete, {
        installationId,
        now: 10 * 60 * 1000,
        runId: "replacement",
      })
    ).toBe("done");
  });

  test("a queued seed request is retained", async () => {
    const t = convexTest(schema, modules);
    const installationId = 990_004;
    await t.mutation(internal.github.materializationLease.claim, {
      installationId,
      now: 0,
      runId: "reconcile",
      seed: false,
    });
    await t.mutation(internal.github.materializationLease.claim, {
      installationId,
      now: 1,
      runId: "queued",
      seed: false,
    });
    await t.mutation(internal.github.materializationLease.claim, {
      installationId,
      now: 2,
      runId: "resync",
      seed: true,
    });
    const lease = await t.run((ctx) =>
      ctx.db
        .query("materializationLease")
        .withIndex("by_installation", (q) =>
          q.eq("installationId", installationId)
        )
        .unique()
    );
    expect(lease).toMatchObject({ status: "pending", seedRequested: true });
  });

  test("pruning expired leases reschedules their accepted work", async () => {
    const t = convexTest(schema, modules);
    const installationId = 990_005;
    await t.run(async (ctx) => {
      await ctx.db.insert("materializationLease", {
        installationId,
        status: "pending",
        leaseExpiresAt: 1,
        runId: "dead",
        seedRequested: true,
      });
      await ctx.db.insert("pullRefresh", {
        key: `${installationId}:acme/widgets#7`,
        installationId,
        owner: "acme",
        repo: "widgets",
        number: 7,
        status: "pending",
        leaseExpiresAt: 1,
        runId: "dead",
      });
    });
    await t.mutation(internal.github.prune.pruneOnce, { now: 2 });
    const scheduled = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").take(10)
    );
    expect(scheduled).toHaveLength(2);
    await t.run(async (ctx) => {
      await Promise.all(scheduled.map((job) => ctx.scheduler.cancel(job._id)));
    });
  });
});
