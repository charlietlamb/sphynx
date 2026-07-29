import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import { testModules as modules } from "../test.helpers";
import { repoKeyOf } from "./rows";

const setup = () => convexTest(schema, modules);
const USER = "user";
const OWNER = "Acme";
const REPO = "Widgets";

describe("repository access epochs", () => {
  test("installation epochs increase when refreshes share a timestamp", async () => {
    const t = setup();
    const args = {
      userId: USER,
      installations: [{ installationId: 2, accountLogin: OWNER }],
      verifiedAt: 100,
    };
    expect(
      await t.mutation(internal.github.access.syncInstallations, args)
    ).toBe(100);
    expect(
      await t.mutation(internal.github.access.syncInstallations, args)
    ).toBe(101);
  });

  test("a stale repository sync cannot replace newer grants", async () => {
    const t = setup();
    await t.run(async (ctx) => {
      await ctx.db.insert("userInstallation", {
        userId: USER,
        installationId: 2,
        accountLogin: OWNER,
        verifiedAt: 200,
      });
      await ctx.db.insert("userRepository", {
        userId: USER,
        installationId: 2,
        repoKey: repoKeyOf(2, OWNER, REPO),
        verifiedAt: 200,
      });
    });
    await t.mutation(internal.github.access.syncRepositories, {
      userId: USER,
      installationId: 2,
      repoKeys: [repoKeyOf(2, "stale", "repo")],
      verifiedAt: 100,
    });
    const rows = await t.run((ctx) =>
      ctx.db
        .query("userRepository")
        .withIndex("by_user_and_installation_and_verifiedAt", (q) =>
          q.eq("userId", USER).eq("installationId", 2)
        )
        .take(10)
    );
    expect(rows).toMatchObject([
      { repoKey: repoKeyOf(2, OWNER, REPO), verifiedAt: 200 },
    ]);
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
