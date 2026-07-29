import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";
import { testModules as modules } from "../test.helpers";
import type { QueuePull, RepoFlow } from "./domain";
import { MAX_PULL_DOCUMENT_BYTES } from "./limits";
import { pullDocFrom, repoKeyOf } from "./rows";

const INSTALLATION = 990_001;
const OWNER = "acme";
const REPO = "widgets";
const REPO_KEY = repoKeyOf(INSTALLATION, OWNER, REPO);

const pull = (overrides: Partial<QueuePull>): QueuePull => ({
  owner: OWNER,
  repo: REPO,
  number: 1,
  title: "Test pull",
  hasBody: false,
  author: { login: "octocat", avatarUrl: "https://x/y.png" },
  isDraft: false,
  state: "open",
  mergedAt: null,
  updatedAt: "2026-07-01T00:00:00Z",
  additions: 10,
  deletions: 5,
  changedFiles: 2,
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
  ...overrides,
});

const setup = () => convexTest(schema, modules);

type T = ReturnType<typeof setup>;

async function claimRun(t: T, runId: string, now: number) {
  expect(
    await t.mutation(internal.github.materializationLease.claim, {
      installationId: INSTALLATION,
      now,
      runId,
      seed: false,
    })
  ).toBe("run");
}

const writeOne = (t: T, value: QueuePull, at: string) =>
  t.mutation(internal.github.writer.writePull, {
    installationId: INSTALLATION,
    owner: OWNER,
    repo: REPO,
    pull: value,
    snapshotAt: new Date(at).getTime(),
    fetchedAt: new Date(at).getTime(),
  });

const readPull = (t: T, number: number) =>
  t.run(async (ctx) =>
    ctx.db
      .query("reviewPull")
      .withIndex("by_key", (q) => q.eq("key", `${REPO_KEY}:${number}`))
      .unique()
  );

async function writeFlow(
  t: T,
  flow: RepoFlow,
  snapshotAt: number,
  now = snapshotAt
) {
  const runId = crypto.randomUUID();
  await claimRun(t, runId, snapshotAt);
  const common = {
    installationId: INSTALLATION,
    owner: flow.owner,
    repo: flow.repo,
    snapshotAt,
    runId,
  };
  await t.mutation(internal.github.writer.writeRepoMetadata, {
    ...common,
    stages: flow.stages,
    gaps: flow.gaps,
  });
  await t.mutation(internal.github.writer.writePullBatch, {
    ...common,
    pulls: flow.openPulls,
    fetchedAt: now,
  });
  await t.mutation(internal.github.writer.finalizeRepo, {
    installationId: INSTALLATION,
    repoKey: repoKeyOf(INSTALLATION, flow.owner, flow.repo),
    snapshotAt,
    now,
    runId,
  });
  await t.mutation(internal.github.materializationLease.complete, {
    installationId: INSTALLATION,
    now,
    runId,
  });
}

describe("writePull monotonicity gate", () => {
  test("materializes a pull with embedded children", async () => {
    const t = setup();
    const applied = await writeOne(
      t,
      pull({
        number: 7,
        title: "Add widget",
        decision: "ready",
        unresolvedThreads: 2,
        ciCounts: { failed: 1, passed: 3, pending: 0 },
        reviewers: [
          {
            name: "alice",
            kind: "human",
            avatarUrl: null,
            state: "approved",
            score: null,
            submittedAt: "2026-07-01T10:00:00Z",
          },
        ],
        ciFailures: [{ name: "build", url: "https://ci/build" }],
        threadPreviews: [
          {
            author: { login: "bob", avatarUrl: "https://x/b.png" },
            body: "needs a test",
            id: "T_1",
            path: "src/x.ts",
            rootCommentId: "42",
          },
        ],
      }),
      "2026-07-01T00:00:00Z"
    );
    expect(applied).toBe(true);
    const row = await readPull(t, 7);
    expect(row?.decision).toBe("ready");
    expect(row?.reviewers[0]?.state).toBe("approved");
    expect(row?.ciFailures[0]?.name).toBe("build");
    expect(row?.threadPreviews[0]?.body).toBe("needs a test");
    expect(row?.threadPreviews[0]?.rootCommentId).toBe("42");
  });

  test("rejects a pull that exceeds the read-model byte budget", async () => {
    const t = setup();
    await expect(
      writeOne(
        t,
        pull({
          threadPreviews: [
            {
              author: null,
              body: "x".repeat(MAX_PULL_DOCUMENT_BYTES),
              id: "T_large",
              path: null,
              rootCommentId: "1",
            },
          ],
        }),
        "2026-07-01T00:00:00Z"
      )
    ).rejects.toThrow("read-model limit");
  });

  test("a stale rewrite does not clobber a newer row", async () => {
    const t = setup();
    await writeOne(
      t,
      pull({ number: 7, title: "FRESH" }),
      "2026-07-01T00:00:00Z"
    );
    const applied = await writeOne(
      t,
      pull({ number: 7, title: "STALE", updatedAt: "2020-01-01T00:00:00Z" }),
      "2026-07-01T00:00:01Z"
    );
    expect(applied).toBe(false);
    const row = await readPull(t, 7);
    expect(row?.title).toBe("FRESH");
  });

  test("a merged pull is not reopened by a lagging same-timestamp write", async () => {
    const t = setup();
    const mergedAt = "2026-07-05T00:00:00Z";
    await writeOne(
      t,
      pull({ number: 21, state: "merged", mergedAt, updatedAt: mergedAt }),
      mergedAt
    );
    await writeOne(
      t,
      pull({ number: 21, state: "open", mergedAt: null, updatedAt: mergedAt }),
      "2026-07-05T06:00:00Z"
    );
    const row = await readPull(t, 21);
    expect(row?.state).toBe("merged");
  });

  test("a genuine reopen with a newer timestamp does land", async () => {
    const t = setup();
    await writeOne(
      t,
      pull({ number: 22, state: "closed", updatedAt: "2026-07-05T00:00:00Z" }),
      "2026-07-05T00:00:00Z"
    );
    await writeOne(
      t,
      pull({
        number: 22,
        state: "open",
        mergedAt: null,
        updatedAt: "2026-07-06T00:00:00Z",
      }),
      "2026-07-06T00:00:00Z"
    );
    const row = await readPull(t, 22);
    expect(row?.state).toBe("open");
  });

  test("reconcile's older snapshot does not overwrite a newer webhook row", async () => {
    const t = setup();
    const sameTs = "2026-07-07T00:00:00Z";
    await writeOne(
      t,
      pull({
        number: 23,
        updatedAt: sameTs,
        ciCounts: { failed: 0, passed: 3, pending: 0 },
      }),
      "2026-07-07T13:00:00Z"
    );
    await t.mutation(internal.github.writer.writePull, {
      installationId: INSTALLATION,
      owner: OWNER,
      repo: REPO,
      pull: pull({
        number: 23,
        updatedAt: sameTs,
        ciCounts: { failed: 0, passed: 0, pending: 3 },
      }),
      snapshotAt: new Date("2026-07-07T12:00:00Z").getTime(),
      fetchedAt: new Date("2026-07-07T12:00:00Z").getTime(),
    });
    const row = await readPull(t, 23);
    expect(row?.ciCounts.passed).toBe(3);
    expect(row?.ciCounts.pending).toBe(0);
  });

  test("a gated reconcile write still stamps open-pull presence", async () => {
    const t = setup();
    const snapshotAt = new Date("2026-07-07T12:00:00Z").getTime();
    const runId = "presence";
    await claimRun(t, runId, snapshotAt);
    await writeOne(t, pull({ number: 24 }), "2026-07-07T13:00:00Z");
    await t.mutation(internal.github.writer.writePullBatch, {
      installationId: INSTALLATION,
      owner: OWNER,
      repo: REPO,
      pulls: [pull({ number: 24 })],
      snapshotAt,
      fetchedAt: snapshotAt,
      runId,
    });
    await t.mutation(internal.github.writer.finalizeRepo, {
      installationId: INSTALLATION,
      repoKey: REPO_KEY,
      snapshotAt,
      now: snapshotAt + 1,
      runId,
    });
    expect((await readPull(t, 24))?.state).toBe("open");
  });

  test("reconciliation closes a departed open pull, sparing fresh ones", async () => {
    const t = setup();
    await writeOne(t, pull({ number: 30 }), "2026-07-01T00:00:00Z");
    await writeOne(t, pull({ number: 31 }), "2026-07-08T00:00:00Z");
    await writeFlow(
      t,
      {
        owner: OWNER,
        repo: REPO,
        stages: ["dev", "main"],
        openPulls: [],
        gaps: [],
      },
      new Date("2026-07-05T00:00:00Z").getTime(),
      new Date("2026-07-05T00:00:01Z").getTime()
    );
    expect((await readPull(t, 30))?.state).toBe("closed");
    expect((await readPull(t, 31))?.state).toBe("open");
  });

  test("finalization drains more than one database batch", async () => {
    const t = setup();
    const fetchedAt = new Date("2026-07-01T00:00:00Z").getTime();
    const runId = "finalize";
    await claimRun(t, runId, fetchedAt);
    await t.run(async (ctx) => {
      for (let number = 1; number <= 150; number += 1) {
        await ctx.db.insert("reviewPull", {
          ...pullDocFrom(INSTALLATION, REPO_KEY, OWNER, REPO, pull({ number })),
          fetchedAt,
        });
      }
    });
    const args = {
      installationId: INSTALLATION,
      repoKey: REPO_KEY,
      snapshotAt: fetchedAt + 1000,
      now: fetchedAt + 2000,
      runId,
    };
    expect(await t.mutation(internal.github.writer.finalizeRepo, args)).toBe(
      true
    );
    expect(await t.mutation(internal.github.writer.finalizeRepo, args)).toBe(
      false
    );
    const closed = await t.run((ctx) =>
      ctx.db
        .query("reviewPull")
        .withIndex("by_repo_and_state_and_presence", (q) =>
          q.eq("repoKey", REPO_KEY).eq("state", "closed")
        )
        .take(200)
    );
    expect(closed).toHaveLength(150);
  });

  test("reconciliation materializes pulls and the stage-gap rail", async () => {
    const t = setup();
    await writeFlow(
      t,
      {
        owner: OWNER,
        repo: REPO,
        stages: ["dev", "main"],
        openPulls: [pull({ number: 40, decision: "ready" })],
        gaps: [
          {
            from: "dev",
            to: "main",
            aheadBy: 0,
            directCommits: 0,
            promotionPull: 40,
            pulls: [],
          },
        ],
      },
      new Date("2026-07-10T00:00:00Z").getTime()
    );
    expect((await readPull(t, 40))?.decision).toBe("ready");
    const gaps = await t.run((ctx) =>
      ctx.db
        .query("stageGap")
        .withIndex("by_repo", (q) => q.eq("repoKey", REPO_KEY))
        .take(100)
    );
    expect(gaps[0]?.promotionPull).toBe(40);
  });

  test("retiring an undiscovered repo deletes its parent row", async () => {
    const t = setup();
    const first = 1_800_000_000_000;
    await writeFlow(
      t,
      {
        owner: OWNER,
        repo: REPO,
        stages: ["main"],
        openPulls: [pull({ number: 41 })],
        gaps: [],
      },
      first
    );
    const snapshotAt = first + 1000;
    const runId = "retire";
    await claimRun(t, runId, snapshotAt);
    expect(
      await t.mutation(internal.github.writer.claimUndiscoveredRepos, {
        installationId: INSTALLATION,
        snapshotAt,
        runId,
      })
    ).toEqual([REPO_KEY]);
    expect(
      await t.mutation(internal.github.writer.retireRepo, {
        installationId: INSTALLATION,
        repoKey: REPO_KEY,
        snapshotAt,
        now: snapshotAt,
        runId,
      })
    ).toBe(false);
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("reviewRepo")
          .withIndex("by_key", (q) => q.eq("key", REPO_KEY))
          .unique()
      )
    ).toBeNull();
  });

  test("retirement transactionally rejects late writes", async () => {
    const t = setup();
    await t.run((ctx) =>
      ctx.db.insert("installation", {
        installationId: INSTALLATION,
        reconciledAt: null,
        retiredAt: Date.now(),
      })
    );
    await writeFlow(
      t,
      {
        owner: OWNER,
        repo: REPO,
        stages: ["main"],
        openPulls: [pull({ number: 42 })],
        gaps: [],
      },
      Date.now()
    );
    expect(
      await t.mutation(internal.github.writer.writePullHead, {
        installationId: INSTALLATION,
        owner: OWNER,
        repo: REPO,
        number: 42,
        headSha: "abc",
      })
    ).toBe(false);
    const rows = await t.run((ctx) =>
      Promise.all([
        ctx.db
          .query("reviewRepo")
          .withIndex("by_installation", (q) =>
            q.eq("installationId", INSTALLATION)
          )
          .take(1),
        ctx.db
          .query("reviewPull")
          .withIndex("by_installation_and_state", (q) =>
            q.eq("installationId", INSTALLATION).eq("state", "open")
          )
          .take(1),
        ctx.db
          .query("pullHead")
          .withIndex("by_installation_and_owner_and_repo_and_number", (q) =>
            q.eq("installationId", INSTALLATION)
          )
          .take(1),
      ])
    );
    expect(rows).toEqual([[], [], []]);
  });

  test("an old installation cannot delete a reinstall's pull head", async () => {
    const t = setup();
    const replacement = INSTALLATION + 1;
    await t.mutation(internal.github.writer.writePullHead, {
      installationId: replacement,
      owner: OWNER,
      repo: REPO,
      number: 43,
      headSha: "new",
    });
    await t.mutation(internal.github.writer.deletePullHead, {
      installationId: INSTALLATION,
      owner: OWNER,
      repo: REPO,
      number: 43,
    });
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("pullHead")
          .withIndex("by_installation_and_owner_and_repo_and_number", (q) =>
            q
              .eq("installationId", replacement)
              .eq("owner", OWNER)
              .eq("repo", REPO)
              .eq("number", 43)
          )
          .unique()
      )
    ).toMatchObject({ installationId: replacement, headSha: "new" });
  });

  test("a replaced materializer cannot regress newer repo state", async () => {
    const t = setup();
    const firstRun = "first";
    const replacementRun = "replacement";
    await claimRun(t, firstRun, 0);
    await claimRun(t, replacementRun, 10 * 60 * 1000);
    const newer = {
      installationId: INSTALLATION,
      owner: OWNER,
      repo: REPO,
      stages: ["dev", "main"],
      gaps: [
        {
          from: "dev",
          to: "main",
          aheadBy: 0,
          directCommits: 0,
          promotionPull: 50,
          pulls: [],
        },
      ],
      snapshotAt: 200,
      runId: replacementRun,
    };
    await t.mutation(internal.github.writer.writeRepoMetadata, newer);
    await t.mutation(internal.github.writer.writePullBatch, {
      installationId: INSTALLATION,
      owner: OWNER,
      repo: REPO,
      pulls: [pull({ number: 50, title: "NEW" })],
      snapshotAt: 200,
      fetchedAt: 200,
      runId: replacementRun,
    });
    await t.mutation(internal.github.writer.writeRepoMetadata, {
      ...newer,
      stages: ["old"],
      gaps: [],
      snapshotAt: 100,
      runId: firstRun,
    });
    await t.mutation(internal.github.writer.writePullBatch, {
      installationId: INSTALLATION,
      owner: OWNER,
      repo: REPO,
      pulls: [pull({ number: 50, title: "OLD" })],
      snapshotAt: 100,
      fetchedAt: 100,
      runId: firstRun,
    });
    await t.mutation(internal.github.writer.writeRepoMetadata, {
      ...newer,
      stages: ["older-current-run"],
      gaps: [],
      snapshotAt: 150,
    });
    await t.mutation(internal.github.writer.writePullBatch, {
      installationId: INSTALLATION,
      owner: OWNER,
      repo: REPO,
      pulls: [pull({ number: 50, title: "OLDER CURRENT RUN" })],
      snapshotAt: 150,
      fetchedAt: 150,
      runId: replacementRun,
    });
    expect(
      await t.mutation(internal.github.writer.finalizeRepo, {
        installationId: INSTALLATION,
        repoKey: REPO_KEY,
        snapshotAt: 300,
        now: 300,
        runId: firstRun,
      })
    ).toBe(false);
    expect(
      await t.mutation(internal.github.writer.claimUndiscoveredRepos, {
        installationId: INSTALLATION,
        snapshotAt: 300,
        runId: firstRun,
      })
    ).toEqual([]);
    expect(
      await t.mutation(internal.github.writer.retireRepo, {
        installationId: INSTALLATION,
        repoKey: REPO_KEY,
        snapshotAt: 200,
        now: 300,
        runId: firstRun,
      })
    ).toBe(false);
    const [repo, gaps, storedPull] = await t.run(async (ctx) =>
      Promise.all([
        ctx.db
          .query("reviewRepo")
          .withIndex("by_key", (q) => q.eq("key", REPO_KEY))
          .unique(),
        ctx.db
          .query("stageGap")
          .withIndex("by_repo", (q) => q.eq("repoKey", REPO_KEY))
          .take(10),
        ctx.db
          .query("reviewPull")
          .withIndex("by_key", (q) => q.eq("key", `${REPO_KEY}:50`))
          .unique(),
      ])
    );
    expect(repo).toMatchObject({
      stages: ["dev", "main"],
      presenceSeenAt: 200,
    });
    expect(gaps[0]?.promotionPull).toBe(50);
    expect(storedPull).toMatchObject({ title: "NEW", presenceSeenAt: 200 });
  });

  test("a stale retire leaves a rediscovered repo's gaps intact", async () => {
    const t = setup();
    const runId = "retire-current";
    await claimRun(t, runId, 0);
    await t.mutation(internal.github.writer.writeRepoMetadata, {
      installationId: INSTALLATION,
      owner: OWNER,
      repo: REPO,
      stages: ["dev", "main"],
      gaps: [
        {
          from: "dev",
          to: "main",
          aheadBy: 0,
          directCommits: 0,
          promotionPull: 51,
          pulls: [],
        },
      ],
      snapshotAt: 200,
      runId,
    });
    expect(
      await t.mutation(internal.github.writer.retireRepo, {
        installationId: INSTALLATION,
        repoKey: REPO_KEY,
        snapshotAt: 100,
        now: 200,
        runId,
      })
    ).toBe(false);
    const gaps = await t.run((ctx) =>
      ctx.db
        .query("stageGap")
        .withIndex("by_repo", (q) => q.eq("repoKey", REPO_KEY))
        .take(10)
    );
    expect(gaps[0]?.promotionPull).toBe(51);
  });

  test("a reinstall owns an independent same-SHA pull head", async () => {
    const t = setup();
    const replacement = INSTALLATION + 1;
    await t.mutation(internal.github.writer.writePullHead, {
      installationId: INSTALLATION,
      owner: OWNER,
      repo: REPO,
      number: 52,
      headSha: "same",
    });
    expect(
      await t.mutation(internal.github.writer.writePullHead, {
        installationId: replacement,
        owner: OWNER,
        repo: REPO,
        number: 52,
        headSha: "same",
      })
    ).toBe(true);
    const head = await t.run((ctx) =>
      ctx.db
        .query("pullHead")
        .withIndex("by_installation_and_owner_and_repo_and_number", (q) =>
          q
            .eq("installationId", replacement)
            .eq("owner", OWNER)
            .eq("repo", REPO)
            .eq("number", 52)
        )
        .unique()
    );
    expect(head?.installationId).toBe(replacement);
  });

  test("retiring a repo preserves another installation's heads", async () => {
    const t = setup();
    const replacement = INSTALLATION + 1;
    const runId = "retire-owned";
    await claimRun(t, runId, 0);
    await t.mutation(internal.github.writer.writeRepoMetadata, {
      installationId: INSTALLATION,
      owner: OWNER,
      repo: REPO,
      stages: [],
      gaps: [],
      snapshotAt: 100,
      runId,
    });
    await t.mutation(internal.github.writer.writePullHead, {
      installationId: replacement,
      owner: OWNER,
      repo: REPO,
      number: 53,
      headSha: "replacement",
    });
    await t.mutation(internal.github.writer.retireRepo, {
      installationId: INSTALLATION,
      repoKey: REPO_KEY,
      snapshotAt: 100,
      now: 100,
      runId,
    });
    const head = await t.run((ctx) =>
      ctx.db
        .query("pullHead")
        .withIndex("by_installation_and_owner_and_repo_and_number", (q) =>
          q
            .eq("installationId", replacement)
            .eq("owner", OWNER)
            .eq("repo", REPO)
            .eq("number", 53)
        )
        .unique()
    );
    expect(head?.installationId).toBe(replacement);
  });
});
