import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";
import { testModules as modules } from "../test.helpers";
import type { QueuePull } from "./domain";
import { repoKeyOf } from "./rows";

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
            rootCommentId: 42,
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
    expect(row?.threadPreviews[0]?.rootCommentId).toBe(42);
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

  test("writeRepoFlow closes a departed open pull, sparing fresh ones", async () => {
    const t = setup();
    await writeOne(t, pull({ number: 30 }), "2026-07-01T00:00:00Z");
    await writeOne(t, pull({ number: 31 }), "2026-07-08T00:00:00Z");
    await t.mutation(internal.github.writer.writeRepoFlow, {
      installationId: INSTALLATION,
      flow: {
        owner: OWNER,
        repo: REPO,
        stages: ["dev", "main"],
        openPulls: [],
        gaps: [],
      },
      snapshotAt: new Date("2026-07-05T00:00:00Z").getTime(),
      now: new Date("2026-07-05T00:00:01Z").getTime(),
    });
    expect((await readPull(t, 30))?.state).toBe("closed");
    expect((await readPull(t, 31))?.state).toBe("open");
  });

  test("writeRepoFlow materializes pulls and the stage-gap rail", async () => {
    const t = setup();
    await t.mutation(internal.github.writer.writeRepoFlow, {
      installationId: INSTALLATION,
      flow: {
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
      snapshotAt: new Date("2026-07-10T00:00:00Z").getTime(),
      now: new Date("2026-07-10T00:00:00Z").getTime(),
    });
    expect((await readPull(t, 40))?.decision).toBe("ready");
    const gaps = await t.run((ctx) =>
      ctx.db
        .query("stageGap")
        .withIndex("by_repo", (q) => q.eq("repoKey", REPO_KEY))
        .collect()
    );
    expect(gaps[0]?.promotionPull).toBe(40);
  });
});
