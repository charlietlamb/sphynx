import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import { testModules as modules } from "../test.helpers";
import { ACCESS_REFRESH_LEASE_MS } from "./access";
import { repoKeyOf } from "./rows";

const setup = () => convexTest(schema, modules);
const USER = "user";
const OWNER = "Acme";
const REPO = "Widgets";
const INSTALLATION = {
  id: 2,
  accountLogin: OWNER,
  accountType: "Organization",
  avatarUrl: null,
  repositorySelection: "selected",
} as const;

describe("repository access epochs", () => {
  test("only one refresh owns an epoch at a time", async () => {
    const t = setup();
    const first = await t.mutation(internal.github.access.beginAccessRefresh, {
      userId: USER,
      runId: "first",
      now: 100,
    });
    const blocked = await t.mutation(
      internal.github.access.beginAccessRefresh,
      { userId: USER, runId: "blocked", now: 101 }
    );
    const takeover = await t.mutation(
      internal.github.access.beginAccessRefresh,
      {
        userId: USER,
        runId: "takeover",
        now: 100 + ACCESS_REFRESH_LEASE_MS + 1,
      }
    );
    expect(first).toEqual({ acquired: true, verifiedAt: 100 });
    expect(blocked).toEqual({ acquired: false, verifiedAt: 100 });
    expect(takeover.acquired).toBe(true);
    expect(takeover.verifiedAt).toBeGreaterThan(first.verifiedAt);
  });

  test("a stale refresh cannot restore a revoked repository", async () => {
    const t = setup();
    const startedAt = Date.now();
    await t.mutation(internal.github.access.beginAccessRefresh, {
      userId: USER,
      runId: "stale",
      now: startedAt,
    });
    expect(
      await t.mutation(internal.github.access.stageRepositories, {
        userId: USER,
        runId: "stale",
        installationId: 2,
        repoKeys: [repoKeyOf(2, OWNER, REPO)],
        now: startedAt,
      })
    ).toBe(true);
    const takeoverAt = startedAt + ACCESS_REFRESH_LEASE_MS + 1;
    await t.mutation(internal.github.access.beginAccessRefresh, {
      userId: USER,
      runId: "current",
      now: takeoverAt,
    });
    expect(
      await t.mutation(internal.github.access.activateAccessRefresh, {
        userId: USER,
        runId: "current",
        installations: [INSTALLATION],
        now: takeoverAt,
      })
    ).toBe(true);
    expect(
      await t.mutation(internal.github.access.stageRepositories, {
        userId: USER,
        runId: "stale",
        installationId: 2,
        repoKeys: [repoKeyOf(2, OWNER, REPO)],
        now: takeoverAt,
      })
    ).toBe(false);
    expect(
      await t
        .withIdentity({ subject: USER })
        .query(api.github.reader.installationForOwner, {
          owner: OWNER,
          repo: REPO,
        })
    ).toBeNull();
  });

  test("staged grants become visible only when activated", async () => {
    const t = setup();
    const now = Date.now();
    await t.mutation(internal.github.access.beginAccessRefresh, {
      userId: USER,
      runId: "refresh",
      now,
    });
    await t.mutation(internal.github.access.stageRepositories, {
      userId: USER,
      runId: "refresh",
      installationId: 2,
      repoKeys: [repoKeyOf(2, OWNER, REPO)],
      now,
    });
    const authed = t.withIdentity({ subject: USER });
    expect(
      await authed.query(api.github.reader.installationForOwner, {
        owner: OWNER,
        repo: REPO,
      })
    ).toBeNull();
    await t.mutation(internal.github.access.activateAccessRefresh, {
      userId: USER,
      runId: "refresh",
      installations: [INSTALLATION],
      now,
    });
    expect(
      await authed.query(api.github.reader.installationForOwner, {
        owner: OWNER,
        repo: REPO,
      })
    ).toBe(2);
  });

  test("aborted refresh cleanup cannot delete a retry's grants", async () => {
    const t = setup();
    const now = Date.now();
    const first = await t.mutation(internal.github.access.beginAccessRefresh, {
      userId: USER,
      runId: "first",
      now,
    });
    await t.mutation(internal.github.access.stageRepositories, {
      userId: USER,
      runId: "first",
      installationId: 2,
      repoKeys: [repoKeyOf(2, OWNER, REPO)],
      now,
    });
    await t.mutation(internal.github.access.abortAccessRefresh, {
      userId: USER,
      runId: "first",
    });

    const retry = await t.mutation(internal.github.access.beginAccessRefresh, {
      userId: USER,
      runId: "retry",
      now,
    });
    expect(retry.verifiedAt).toBeGreaterThan(first.verifiedAt);
    await t.mutation(internal.github.access.stageRepositories, {
      userId: USER,
      runId: "retry",
      installationId: 2,
      repoKeys: [repoKeyOf(2, OWNER, REPO)],
      now,
    });
    await t.mutation(internal.github.access.deleteRepositoryGrants, {
      userId: USER,
      verifiedAt: first.verifiedAt,
    });
    await t.mutation(internal.github.access.activateAccessRefresh, {
      userId: USER,
      runId: "retry",
      installations: [INSTALLATION],
      now,
    });

    expect(
      await t
        .withIdentity({ subject: USER })
        .query(api.github.reader.installationForOwner, {
          owner: OWNER,
          repo: REPO,
        })
    ).toBe(2);
  });

  test("starting a refresh keeps the active epoch until activation", async () => {
    const t = setup();
    const now = Date.now();
    await t.mutation(internal.github.access.beginAccessRefresh, {
      userId: USER,
      runId: "active",
      now,
    });
    await t.mutation(internal.github.access.stageRepositories, {
      userId: USER,
      runId: "active",
      installationId: 2,
      repoKeys: [repoKeyOf(2, OWNER, REPO)],
      now,
    });
    await t.mutation(internal.github.access.activateAccessRefresh, {
      userId: USER,
      runId: "active",
      installations: [INSTALLATION],
      now,
    });
    await t.mutation(internal.github.access.beginAccessRefresh, {
      userId: USER,
      runId: "next",
      now: now + 1,
    });

    const deleteJobs = await t.run(async (ctx) =>
      (await ctx.db.system.query("_scheduled_functions").take(10)).filter(
        (job) => job.name.endsWith("github/access:deleteRepositoryGrants")
      )
    );
    expect(deleteJobs).toHaveLength(0);
    expect(
      await t
        .withIdentity({ subject: USER })
        .query(api.github.reader.installationForOwner, {
          owner: OWNER,
          repo: REPO,
        })
    ).toBe(2);
  });

  test("a late abort cannot invalidate an activated epoch", async () => {
    const t = setup();
    const now = Date.now();
    await t.mutation(internal.github.access.beginAccessRefresh, {
      userId: USER,
      runId: "complete",
      now,
    });
    await t.mutation(internal.github.access.stageRepositories, {
      userId: USER,
      runId: "complete",
      installationId: 2,
      repoKeys: [repoKeyOf(2, OWNER, REPO)],
      now,
    });
    await t.mutation(internal.github.access.activateAccessRefresh, {
      userId: USER,
      runId: "complete",
      installations: [INSTALLATION],
      now,
    });
    await t.mutation(internal.github.access.abortAccessRefresh, {
      userId: USER,
      runId: "complete",
    });

    expect(
      await t
        .withIdentity({ subject: USER })
        .query(api.github.reader.installationForOwner, {
          owner: OWNER,
          repo: REPO,
        })
    ).toBe(2);
  });

  test("repo lookup selects the active granted reinstall", async () => {
    const t = setup();
    const verifiedAt = Date.now();
    await t.run(async (ctx) => {
      await ctx.db.insert("reviewRepo", {
        key: repoKeyOf(1, OWNER, REPO),
        installationId: 1,
        owner: OWNER.toLowerCase(),
        repo: REPO.toLowerCase(),
        defaultBranch: null,
        stages: [],
      });
      await ctx.db.insert("reviewRepo", {
        key: repoKeyOf(2, OWNER, REPO),
        installationId: 2,
        owner: OWNER.toLowerCase(),
        repo: REPO.toLowerCase(),
        defaultBranch: null,
        stages: [],
      });
      await ctx.db.insert("userInstallation", {
        userId: USER,
        installationId: 2,
        accountLogin: OWNER,
        verifiedAt,
      });
      await ctx.db.insert("userRepository", {
        userId: USER,
        installationId: 2,
        repoKey: repoKeyOf(2, OWNER, REPO),
        verifiedAt,
      });
    });
    expect(
      await t
        .withIdentity({ subject: USER })
        .query(api.github.reader.installationForOwner, {
          owner: OWNER,
          repo: REPO,
        })
    ).toBe(2);
  });
});
