import { Database } from "@sphynx/db/client";
import {
  pullHead,
  reviewCheck,
  reviewPull,
  reviewRepo,
  reviewReviewer,
  reviewThread,
  stageGap,
  stageGapPull,
  workbenchEvent,
} from "@sphynx/db/schema";
import type {
  Pipeline,
  QueuePull,
  RepoFlow,
} from "@sphynx/schema/review-queue";
import { and, eq, lt, notInArray, sql } from "drizzle-orm";
import { Clock, Context, Effect, Layer } from "effect";
import {
  DIRTY_CHANNEL,
  encodePullDirty,
  PULL_DIRTY_CHANNEL,
} from "./event-bus";
import {
  gapRows,
  type PullRows,
  pullRows,
  repoRowId,
  type WorkbenchEventRow,
} from "./read-model-rows";

type Tx = Parameters<Parameters<Database["Type"]["transaction"]>[0]>[0];

const writeChildren = async (tx: Tx, rows: PullRows) => {
  await tx
    .delete(reviewReviewer)
    .where(eq(reviewReviewer.pullId, rows.pull.id));
  await tx.delete(reviewCheck).where(eq(reviewCheck.pullId, rows.pull.id));
  await tx.delete(reviewThread).where(eq(reviewThread.pullId, rows.pull.id));
  if (rows.reviewers.length > 0) {
    await tx.insert(reviewReviewer).values(rows.reviewers);
  }
  if (rows.checks.length > 0) {
    await tx.insert(reviewCheck).values(rows.checks);
  }
  if (rows.threads.length > 0) {
    await tx.insert(reviewThread).values(rows.threads);
  }
};

const writePullRows = async (
  tx: Tx,
  installationId: number,
  repoId: string,
  pull: QueuePull,
  now: Date
) => {
  const rows = pullRows(installationId, repoId, pull);
  const applied = await tx
    .insert(reviewPull)
    .values({ ...rows.pull, fetchedAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: reviewPull.id,
      set: { ...rows.pull, fetchedAt: now, updatedAt: now },
      setWhere: lt(reviewPull.ghUpdatedAt, rows.pull.ghUpdatedAt),
    })
    .returning({ id: reviewPull.id });
  if (applied.length > 0) {
    await writeChildren(tx, rows);
  }
};

const upsertRepo = async (
  tx: Tx,
  installationId: number,
  owner: string,
  repo: string,
  stages: readonly string[],
  now: Date
) => {
  const repoId = repoRowId(installationId, owner, repo);
  await tx
    .insert(reviewRepo)
    .values({
      id: repoId,
      installationId,
      owner,
      repo,
      stages: [...stages],
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: reviewRepo.id,
      set: { stages: [...stages], updatedAt: now },
    });
  return repoId;
};

const makeReadModelWriter = Effect.gen(function* () {
  const db = yield* Database;

  /**
   * Wake any SSE subscribers for this installation. Best-effort: a failed
   * notify only means a client waits for its next poll/reconnect, so it never
   * fails the write.
   */
  const notifyDirty = (installationId: number) =>
    Effect.tryPromise(() =>
      db.execute(
        sql`SELECT pg_notify(${DIRTY_CHANNEL}, ${String(installationId)})`
      )
    ).pipe(
      Effect.catchAllCause((cause) =>
        Effect.logWarning("read-model notify failed", cause)
      )
    );

  /**
   * Record a PR's head sha and wake the PR-page subscribers. The freshness
   * signal for the PR page: the client compares the pushed sha to the one it
   * loaded and refetches the (still live-GitHub) summary/conversation/threads.
   * Only fires when the sha actually moved, so re-deliveries are quiet.
   */
  const writePullHead = (
    installationId: number,
    owner: string,
    repo: string,
    number: number,
    headSha: string
  ) =>
    Effect.gen(function* () {
      const now = new Date(yield* Clock.currentTimeMillis);
      const moved = yield* Effect.tryPromise(() =>
        db
          .insert(pullHead)
          .values({
            installationId,
            owner,
            repo,
            number,
            headSha,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [pullHead.owner, pullHead.repo, pullHead.number],
            set: { headSha, installationId, updatedAt: now },
            setWhere: sql`${pullHead.headSha} <> ${headSha}`,
          })
          .returning({ number: pullHead.number })
      ).pipe(Effect.orDie);
      if (moved.length === 0) {
        return;
      }
      const payload = encodePullDirty({
        installationId,
        owner,
        repo,
        number,
        headSha,
      });
      yield* Effect.tryPromise(() =>
        db.execute(sql`SELECT pg_notify(${PULL_DIRTY_CHANNEL}, ${payload})`)
      ).pipe(
        Effect.catchAllCause((cause) =>
          Effect.logWarning("pull-head notify failed", cause)
        )
      );
    }).pipe(
      Effect.withSpan("ReadModelWriter.writePullHead"),
      Effect.annotateLogs({
        "github.installation": installationId,
        "github.repo": `${owner}/${repo}`,
        "github.pull_number": number,
      })
    );

  const writeRepo = async (
    tx: Tx,
    installationId: number,
    flow: RepoFlow,
    now: Date
  ) => {
    const repoId = await upsertRepo(
      tx,
      installationId,
      flow.owner,
      flow.repo,
      flow.stages,
      now
    );

    for (const pull of flow.openPulls) {
      await writePullRows(tx, installationId, repoId, pull, now);
    }

    const openNumbers = flow.openPulls.map((pull) => pull.number);
    await tx
      .update(reviewPull)
      .set({ state: "merged", updatedAt: now })
      .where(
        openNumbers.length > 0
          ? and(
              eq(reviewPull.repoId, repoId),
              eq(reviewPull.state, "open"),
              notInArray(reviewPull.number, openNumbers)
            )
          : and(eq(reviewPull.repoId, repoId), eq(reviewPull.state, "open"))
      );

    await tx.delete(stageGap).where(eq(stageGap.repoId, repoId));
    await tx.delete(stageGapPull).where(eq(stageGapPull.repoId, repoId));
    const { gaps, gapPulls } = gapRows(installationId, repoId, flow);
    if (gaps.length > 0) {
      await tx
        .insert(stageGap)
        .values(gaps.map((gap) => ({ ...gap, computedAt: now })));
    }
    if (gapPulls.length > 0) {
      await tx.insert(stageGapPull).values(gapPulls);
    }
  };

  const writePipeline = (installationId: number, pipeline: Pipeline) =>
    Effect.gen(function* () {
      const now = new Date(yield* Clock.currentTimeMillis);
      yield* Effect.tryPromise(() =>
        db.transaction(async (tx) => {
          for (const flow of pipeline.repos) {
            await writeRepo(tx, installationId, flow, now);
          }
        })
      ).pipe(Effect.orDie);
      yield* notifyDirty(installationId);
    }).pipe(
      Effect.withSpan("ReadModelWriter.writePipeline"),
      Effect.annotateLogs({
        "github.installation": installationId,
        repoCount: pipeline.repos.length,
      })
    );

  /**
   * The projector's per-PR write: upsert one pull's rows without touching the
   * repo's stages (a webhook does not carry them). The repo row is ensured to
   * exist for the FK but its stages are left to the backfill/rail recompute.
   */
  const writePull = (
    installationId: number,
    owner: string,
    repo: string,
    pull: QueuePull
  ) =>
    Effect.gen(function* () {
      const now = new Date(yield* Clock.currentTimeMillis);
      yield* Effect.tryPromise(() =>
        db.transaction(async (tx) => {
          const repoId = repoRowId(installationId, owner, repo);
          await tx
            .insert(reviewRepo)
            .values({
              id: repoId,
              installationId,
              owner,
              repo,
              stages: [],
              createdAt: now,
              updatedAt: now,
            })
            .onConflictDoNothing();
          await writePullRows(tx, installationId, repoId, pull, now);
        })
      ).pipe(Effect.orDie);
      yield* notifyDirty(installationId);
    }).pipe(
      Effect.withSpan("ReadModelWriter.writePull"),
      Effect.annotateLogs({
        "github.installation": installationId,
        "github.repo": `${owner}/${repo}`,
        "github.pull_number": pull.number,
      })
    );

  /**
   * Append workbench events. Idempotent on the delivery-scoped id, so a webhook
   * redelivery or an overlapping seed is a no-op. Notifies once so an open feed
   * refreshes. Empty input is a no-op (no spurious notify).
   */
  const writeWorkbenchEvents = (
    installationId: number,
    rows: readonly WorkbenchEventRow[]
  ) =>
    Effect.gen(function* () {
      if (rows.length === 0) {
        return;
      }
      yield* Effect.tryPromise(() =>
        db
          .insert(workbenchEvent)
          .values([...rows])
          .onConflictDoNothing()
      ).pipe(Effect.orDie);
      yield* notifyDirty(installationId);
    }).pipe(
      Effect.withSpan("ReadModelWriter.writeWorkbenchEvents"),
      Effect.annotateLogs({
        "github.installation": installationId,
        eventCount: rows.length,
      })
    );

  return { writePipeline, writePull, writePullHead, writeWorkbenchEvents };
});

export class ReadModelWriter extends Context.Tag(
  "@sphynx/server/ReadModelWriter"
)<ReadModelWriter, Effect.Effect.Success<typeof makeReadModelWriter>>() {}

export const ReadModelWriterLive = Layer.effect(
  ReadModelWriter,
  makeReadModelWriter
);
