import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import { testModules as modules } from "../test.helpers";
import type { QueuePull } from "./domain";
import { repoKeyOf } from "./rows";

const setup = () => convexTest(schema, modules);
type T = ReturnType<typeof setup>;

const INSTALL = 555;
const OWNER = "acme";
const REPO = "widgets";
const USER = "test-user";

const authorize = async (t: T) => {
  await t.run(async (ctx) => {
    const verifiedAt = Date.now();
    await ctx.db.insert("userInstallation", {
      userId: USER,
      installationId: INSTALL,
      accountLogin: OWNER,
      verifiedAt,
    });
    await ctx.db.insert("userRepository", {
      userId: USER,
      installationId: INSTALL,
      repoKey: repoKeyOf(INSTALL, OWNER, REPO),
      verifiedAt,
    });
  });
  return t.withIdentity({ subject: USER });
};

const pull = (over: Partial<QueuePull>): QueuePull => ({
  owner: OWNER,
  repo: REPO,
  number: 1,
  title: "Test",
  hasBody: false,
  author: { login: "octocat", avatarUrl: null },
  isDraft: false,
  state: "open",
  mergedAt: null,
  updatedAt: "2026-07-01T00:00:00Z",
  additions: 1,
  deletions: 0,
  changedFiles: 1,
  ci: "success",
  headRefName: "feature/a",
  baseRefName: "dev",
  reviewers: [],
  reviewerCount: 0,
  botReviewerCount: 0,
  approvals: 0,
  changesRequested: 0,
  unresolvedThreads: 0,
  ciFailures: [],
  ciCounts: { failed: 0, passed: 0, pending: 0 },
  threadPreviews: [],
  decision: "needs-eyes",
  blocker: null,
  ...over,
});

const materialize = async (
  t: Pick<T, "mutation">,
  values: Parameters<typeof pull>[0][],
  repo = REPO
) => {
  const snapshotAt = new Date("2026-07-01T00:00:00Z").getTime();
  const runId = crypto.randomUUID();
  await t.mutation(internal.github.materializationLease.claim, {
    installationId: INSTALL,
    now: snapshotAt,
    runId,
    seed: false,
  });
  const common = {
    installationId: INSTALL,
    owner: OWNER,
    repo,
    snapshotAt,
    runId,
  };
  await t.mutation(internal.github.writer.writeRepoMetadata, {
    ...common,
    stages: ["dev", "main"],
    gaps: [
      {
        from: "dev",
        to: "main",
        aheadBy: 0,
        directCommits: 0,
        promotionPull: null,
        pulls: [],
      },
    ],
  });
  await t.mutation(internal.github.writer.writePullBatch, {
    ...common,
    pulls: values.map((value) => pull({ ...value, repo })),
    fetchedAt: snapshotAt,
  });
  await t.mutation(internal.github.materializationLease.complete, {
    installationId: INSTALL,
    now: snapshotAt,
    runId,
  });
};

describe("read model queries", () => {
  test("head lookup normalizes repo casing and isolates installations", async () => {
    const t = setup();
    const replacement = INSTALL + 1;
    await Promise.all([
      t.mutation(internal.github.writer.writePullHead, {
        installationId: INSTALL,
        owner: "Acme",
        repo: "Widgets",
        number: 1,
        headSha: "same-head",
      }),
      t.mutation(internal.github.writer.writePullHead, {
        installationId: replacement,
        owner: OWNER,
        repo: REPO,
        number: 2,
        headSha: "same-head",
      }),
    ]);

    expect(
      await t.query(internal.github.reader.pullNumbersForHead, {
        installationId: replacement,
        owner: "ACME",
        repo: "WIDGETS",
        headSha: "same-head",
      })
    ).toEqual([2]);
  });

  test("materialized reads fail closed without installation access", async () => {
    const t = setup();
    await expect(
      t.query(api.github.reader.getPipeline, { installationId: INSTALL })
    ).rejects.toThrow("Authentication required");
    await expect(
      t
        .withIdentity({ subject: "other-user" })
        .query(api.github.reader.getPipeline, { installationId: INSTALL })
    ).rejects.toThrow("do not have access");
  });

  test("getPipeline reconstructs repo flows with derived counters", async () => {
    const t = await authorize(setup());
    await materialize(t, [
      {
        number: 1,
        decision: "ready",
        reviewers: [
          {
            name: "alice",
            kind: "human",
            avatarUrl: null,
            state: "approved",
            score: null,
            submittedAt: "2026-07-01T10:00:00Z",
          },
          {
            name: "bot",
            kind: "bot",
            avatarUrl: null,
            state: "changes-requested",
            score: "2/5",
            submittedAt: "2026-07-01T11:00:00Z",
          },
        ],
      },
    ]);
    const pipeline = await t.query(api.github.reader.getPipeline, {
      installationId: INSTALL,
    });
    expect(pipeline.repos).toHaveLength(1);
    const p = pipeline.repos[0]?.openPulls[0];
    expect(p?.decision).toBe("ready");
    expect(p?.reviewerCount).toBe(2);
    expect(p?.botReviewerCount).toBe(1);
    expect(p?.approvals).toBe(1);
    expect(p?.changesRequested).toBe(1);
    expect(pipeline.repos[0]?.gaps).toHaveLength(1);
  });

  test("an installation grant does not expose an ungranted repository", async () => {
    const t = await authorize(setup());
    await materialize(t, [{ number: 1 }]);
    await materialize(t, [{ number: 2 }], "private");

    const pipeline = await t.query(api.github.reader.getPipeline, {
      installationId: INSTALL,
    });
    expect(pipeline.repos.map((repo: { repo: string }) => repo.repo)).toEqual([
      REPO,
    ]);
  });

  test("a repo with no open pulls does not surface in the pipeline", async () => {
    const t = await authorize(setup());
    const pipeline = await t.query(api.github.reader.getPipeline, {
      installationId: INSTALL,
    });
    expect(pipeline.repos).toEqual([]);
  });

  test("installationForOwner resolves from the read model", async () => {
    const base = setup();
    const t = await authorize(base);
    await materialize(t, [{ number: 1 }]);
    const id = await t.query(api.github.reader.installationForOwner, {
      owner: OWNER,
      repo: REPO,
    });
    expect(id).toBe(INSTALL);
    const missing = await t.query(api.github.reader.installationForOwner, {
      owner: "nobody",
      repo: REPO,
    });
    expect(missing).toBeNull();
    const other = base.withIdentity({ subject: "other-user" });
    expect(
      await other.query(api.github.reader.installationForOwner, {
        owner: OWNER,
        repo: REPO,
      })
    ).toBeNull();
  });
});
