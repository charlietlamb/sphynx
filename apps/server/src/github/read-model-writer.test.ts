import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Database, DatabaseLive } from "@sphynx/db/client";
import { DatabaseConfigLive } from "@sphynx/db/config";
import {
  reviewCheck,
  reviewPull,
  reviewRepo,
  reviewReviewer,
  reviewThread,
  stageGap,
  stageGapPull,
} from "@sphynx/db/schema";
import type {
  Pipeline,
  QueuePull,
  RepoFlow,
} from "@sphynx/schema/review-queue";
import { and, eq } from "drizzle-orm";
import { Effect, Layer, ManagedRuntime } from "effect";
import { pullRowId, repoRowId } from "./read-model-rows";
import { ReadModelWriter, ReadModelWriterLive } from "./read-model-writer";

const INSTALLATION = 990_001;

const hasDatabase = Boolean(process.env.DATABASE_URL);

const layer = ReadModelWriterLive.pipe(
  Layer.provideMerge(DatabaseLive),
  Layer.provide(DatabaseConfigLive)
);

const runtime = ManagedRuntime.make(layer);

const pull = (overrides: Partial<QueuePull>): QueuePull => ({
  owner: "acme",
  repo: "widgets",
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

const flow = (overrides: Partial<RepoFlow>): RepoFlow => ({
  owner: "acme",
  repo: "widgets",
  stages: ["dev", "main"],
  openPulls: [],
  gaps: [],
  ...overrides,
});

const write = (pipeline: Pipeline, snapshotAt = new Date()) =>
  runtime.runPromise(
    Effect.flatMap(ReadModelWriter, (writer) =>
      writer.writePipeline(INSTALLATION, pipeline, snapshotAt)
    )
  );

const writeOne = (value: QueuePull) =>
  runtime.runPromise(
    Effect.flatMap(ReadModelWriter, (writer) =>
      writer.writePull(INSTALLATION, value.owner, value.repo, value)
    )
  );

const query = <A>(run: (db: Database["Type"]) => Promise<A>) =>
  runtime.runPromise(
    Effect.flatMap(Database, (db) => Effect.promise(() => run(db)))
  );

const clean = () =>
  query((db) =>
    db.delete(reviewRepo).where(eq(reviewRepo.installationId, INSTALLATION))
  );

describe.skipIf(!hasDatabase)("ReadModelWriter.writePipeline", () => {
  beforeAll(clean);
  afterAll(async () => {
    await clean();
    await runtime.dispose();
  });

  test("materializes repo, pull, reviewers, checks, threads and gaps", async () => {
    await write({
      repos: [
        flow({
          openPulls: [
            pull({
              number: 7,
              title: "Add widget",
              decision: "ready",
              additions: 120,
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
          ],
          gaps: [
            {
              from: "dev",
              to: "main",
              aheadBy: 3,
              directCommits: 1,
              promotionPull: null,
              pulls: [
                {
                  number: 5,
                  title: "Earlier merge",
                  body: null,
                  author: { login: "carol", avatarUrl: "https://x/c.png" },
                  mergedAt: "2026-06-30T00:00:00Z",
                },
              ],
            },
          ],
        }),
      ],
    });

    const repoId = repoRowId(INSTALLATION, "acme", "widgets");
    const pullId = pullRowId(repoId, 7);

    const repo = await query((db) =>
      db.select().from(reviewRepo).where(eq(reviewRepo.id, repoId))
    );
    expect(repo[0]?.stages).toEqual(["dev", "main"]);

    const pulls = await query((db) =>
      db.select().from(reviewPull).where(eq(reviewPull.id, pullId))
    );
    expect(pulls[0]?.decision).toBe("ready");
    expect(pulls[0]?.unresolvedThreads).toBe(2);
    expect(pulls[0]?.ciFailed).toBe(1);
    expect(pulls[0]?.ciPassed).toBe(3);

    const reviewers = await query((db) =>
      db.select().from(reviewReviewer).where(eq(reviewReviewer.pullId, pullId))
    );
    expect(reviewers).toHaveLength(1);
    expect(reviewers[0]?.state).toBe("approved");

    const checks = await query((db) =>
      db.select().from(reviewCheck).where(eq(reviewCheck.pullId, pullId))
    );
    expect(checks[0]?.name).toBe("build");

    const threads = await query((db) =>
      db.select().from(reviewThread).where(eq(reviewThread.pullId, pullId))
    );
    expect(threads[0]?.bodyPreview).toBe("needs a test");
    expect(threads[0]?.rootCommentId).toBe(42);

    const gaps = await query((db) =>
      db.select().from(stageGap).where(eq(stageGap.repoId, repoId))
    );
    expect(gaps[0]?.aheadBy).toBe(3);

    const gapPulls = await query((db) =>
      db.select().from(stageGapPull).where(eq(stageGapPull.repoId, repoId))
    );
    expect(gapPulls[0]?.number).toBe(5);
  });

  test("a stale rewrite does not clobber a newer row", async () => {
    const repoId = repoRowId(INSTALLATION, "acme", "widgets");
    const pullId = pullRowId(repoId, 7);
    await write({
      repos: [
        flow({
          openPulls: [
            pull({
              number: 7,
              title: "STALE",
              updatedAt: "2020-01-01T00:00:00Z",
            }),
          ],
        }),
      ],
    });
    const pulls = await query((db) =>
      db.select().from(reviewPull).where(eq(reviewPull.id, pullId))
    );
    expect(pulls[0]?.title).not.toBe("STALE");
  });

  test("a pull that leaves the open set is marked non-open", async () => {
    const repoId = repoRowId(INSTALLATION, "acme", "widgets");
    const pullId = pullRowId(repoId, 7);
    await write({ repos: [flow({ openPulls: [] })] });
    const pulls = await query((db) =>
      db
        .select()
        .from(reviewPull)
        .where(and(eq(reviewPull.id, pullId), eq(reviewPull.state, "open")))
    );
    expect(pulls).toHaveLength(0);
  });

  test("a merged pull is not reopened by a lagging same-timestamp write", async () => {
    const repoId = repoRowId(INSTALLATION, "acme", "widgets");
    const pullId = pullRowId(repoId, 21);
    const mergedAt = "2026-07-05T00:00:00Z";
    await writeOne(
      pull({ number: 21, state: "merged", mergedAt, updatedAt: mergedAt })
    );
    await writeOne(
      pull({ number: 21, state: "open", mergedAt: null, updatedAt: mergedAt })
    );
    const pulls = await query((db) =>
      db.select().from(reviewPull).where(eq(reviewPull.id, pullId))
    );
    expect(pulls[0]?.state).toBe("merged");
  });

  test("a genuine reopen with a newer timestamp does land", async () => {
    const repoId = repoRowId(INSTALLATION, "acme", "widgets");
    const pullId = pullRowId(repoId, 22);
    await writeOne(
      pull({
        number: 22,
        state: "closed",
        updatedAt: "2026-07-05T00:00:00Z",
      })
    );
    await writeOne(
      pull({
        number: 22,
        state: "open",
        mergedAt: null,
        updatedAt: "2026-07-06T00:00:00Z",
      })
    );
    const pulls = await query((db) =>
      db.select().from(reviewPull).where(eq(reviewPull.id, pullId))
    );
    expect(pulls[0]?.state).toBe("open");
  });

  test("reconcile's older snapshot does not overwrite a newer webhook row", async () => {
    const repoId = repoRowId(INSTALLATION, "acme", "widgets");
    const pullId = pullRowId(repoId, 23);
    const sameTs = "2026-07-07T00:00:00Z";
    const snapshotAt = new Date("2026-07-07T12:00:00Z");
    await writeOne(
      pull({
        number: 23,
        updatedAt: sameTs,
        ciCounts: { failed: 0, passed: 0, pending: 3 },
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 5));
    await writeOne(
      pull({
        number: 23,
        updatedAt: sameTs,
        ciCounts: { failed: 0, passed: 3, pending: 0 },
      })
    );
    await write(
      {
        repos: [
          flow({
            openPulls: [
              pull({
                number: 23,
                updatedAt: sameTs,
                ciCounts: { failed: 0, passed: 0, pending: 3 },
              }),
            ],
          }),
        ],
      },
      snapshotAt
    );
    const pulls = await query((db) =>
      db.select().from(reviewPull).where(eq(reviewPull.id, pullId))
    );
    expect(pulls[0]?.ciPassed).toBe(3);
    expect(pulls[0]?.ciPending).toBe(0);
  });
});
