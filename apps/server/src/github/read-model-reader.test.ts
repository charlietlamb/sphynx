import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Database, DatabaseLive } from "@sphynx/db/client";
import { DatabaseConfigLive } from "@sphynx/db/config";
import { reviewRepo } from "@sphynx/db/schema";
import type {
  Pipeline,
  QueuePull,
  RepoFlow,
} from "@sphynx/schema/review-queue";
import { eq } from "drizzle-orm";
import { Effect, Layer, ManagedRuntime } from "effect";
import { ReadModelReader, ReadModelReaderLive } from "./read-model-reader";
import { ReadModelWriter, ReadModelWriterLive } from "./read-model-writer";

const INSTALLATION = 990_002;

const hasDatabase = Boolean(process.env.DATABASE_URL);

const layer = Layer.mergeAll(ReadModelWriterLive, ReadModelReaderLive).pipe(
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
  updatedAt: "2026-07-01T00:00:00.000Z",
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

const clean = () =>
  runtime.runPromise(
    Effect.flatMap(Database, (db) =>
      Effect.promise(() =>
        db.delete(reviewRepo).where(eq(reviewRepo.installationId, INSTALLATION))
      )
    )
  );

describe.skipIf(!hasDatabase)("read model round trip", () => {
  beforeAll(clean);
  afterAll(async () => {
    await clean();
    await runtime.dispose();
  });

  test("write then read reconstructs the pipeline", async () => {
    const source: Pipeline = {
      repos: [
        flow({
          openPulls: [
            pull({
              number: 7,
              title: "Add widget",
              decision: "ready",
              approvals: 1,
              reviewerCount: 1,
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
                  submittedAt: "2026-07-01T10:00:00.000Z",
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
                  mergedAt: "2026-06-30T00:00:00.000Z",
                },
              ],
            },
          ],
        }),
      ],
    };

    await runtime.runPromise(
      Effect.flatMap(ReadModelWriter, (writer) =>
        writer.writePipeline(INSTALLATION, source, new Date())
      )
    );

    const read = await runtime.runPromise(
      Effect.flatMap(ReadModelReader, (reader) =>
        reader.readPipeline(INSTALLATION)
      )
    );

    expect(read.repos).toHaveLength(1);
    const repo = read.repos[0];
    expect(repo?.owner).toBe("acme");
    expect(repo?.stages).toEqual(["dev", "main"]);
    expect(repo?.openPulls).toHaveLength(1);

    const built = repo?.openPulls[0];
    expect(built).toMatchObject({
      owner: "acme",
      repo: "widgets",
      number: 7,
      title: "Add widget",
      decision: "ready",
      approvals: 1,
      reviewerCount: 1,
      unresolvedThreads: 2,
      ci: "success",
    });
    expect(built?.ciCounts).toEqual({ failed: 1, passed: 3, pending: 0 });
    expect(built?.ciFailures).toEqual([
      { name: "build", url: "https://ci/build" },
    ]);
    expect(built?.reviewers[0]).toMatchObject({
      name: "alice",
      state: "approved",
    });
    expect(built?.threadPreviews[0]).toMatchObject({
      id: "T_1",
      body: "needs a test",
      rootCommentId: 42,
    });

    expect(repo?.gaps).toHaveLength(1);
    expect(repo?.gaps[0]).toMatchObject({
      from: "dev",
      to: "main",
      aheadBy: 3,
      directCommits: 1,
    });
    expect(repo?.gaps[0]?.pulls[0]).toMatchObject({
      number: 5,
      title: "Earlier merge",
    });
  });

  test("readQueue returns open pulls without the rail", async () => {
    const read = await runtime.runPromise(
      Effect.flatMap(ReadModelReader, (reader) =>
        reader.readQueue(INSTALLATION)
      )
    );
    expect(read.repos[0]?.openPulls).toHaveLength(1);
    expect(read.repos[0]).not.toHaveProperty("gaps");
  });
});
