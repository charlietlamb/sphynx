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
  webhookDelivery,
  workbenchEvent,
} from "@sphynx/db/schema";
import type {
  Pipeline,
  QueuePull,
  RepoFlow,
} from "@sphynx/schema/review-queue";
import { and, eq, inArray, lt, notInArray, sql } from "drizzle-orm";
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
  now: Date,
  snapshotAt: Date
) => {
  const rows = pullRows(installationId, repoId, pull);
  /**
   * Last-writer-wins on `(gh_updated_at, fetched_at)`, with two guards.
   *
   * `gh_updated_at` alone is not enough: `check_run`/`status` events don't bump
   * a PR's `updated_at`, so a CI update carries the same `gh_updated_at` as the
   * push before it and would be dropped by a strict `<`. The tie-break lets a
   * write win on an equal `gh_updated_at` — but only against a row that predates
   * this snapshot (`fetched_at < snapshotAt`). A live webhook passes
   * `snapshotAt = now`, so its fresh CI refetch still wins every tie; a reconcile
   * passes the instant it began reading GitHub, so its stale snapshot loses the
   * tie to any webhook that landed after the snapshot — the model never moves
   * backward on the large class of events that leave `gh_updated_at` unchanged.
   *
   * The second guard is state monotonicity: a terminal row (`merged`/`closed`)
   * is not reopened by a write that isn't strictly newer by `gh_updated_at`. A
   * lagging GitHub read replica can return a pre-merge `state=open` snapshot
   * whose `updated_at` still equals the merge's, winning the tie and resurrecting
   * a merged PR into the open queue. A genuine reopen bumps `gh_updated_at`
   * strictly past the merge, so it still lands.
   */
  const staleReopen = sql`${reviewPull.state} <> 'open' AND ${rows.pull.state} = 'open' AND ${rows.pull.ghUpdatedAt} <= ${reviewPull.ghUpdatedAt}`;
  const applied = await tx
    .insert(reviewPull)
    .values({ ...rows.pull, fetchedAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: reviewPull.id,
      set: { ...rows.pull, fetchedAt: now, updatedAt: now },
      setWhere: sql`(${reviewPull.ghUpdatedAt}, ${reviewPull.fetchedAt}) < (${rows.pull.ghUpdatedAt}, ${snapshotAt}) AND NOT (${staleReopen})`,
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
    now: Date,
    snapshotAt: Date
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
      await writePullRows(tx, installationId, repoId, pull, now, snapshotAt);
    }

    /**
     * Close pulls that left the open set — but only ones not touched since the
     * GitHub snapshot began. A pull a concurrent webhook opened *during* the
     * snapshot has `fetched_at >= snapshotAt` and is spared, so a full rebuild
     * never marks a freshly-opened PR merged just because it postdates the
     * snapshot.
     */
    const openNumbers = flow.openPulls.map((pull) => pull.number);
    const departed = and(
      eq(reviewPull.repoId, repoId),
      eq(reviewPull.state, "open"),
      lt(reviewPull.fetchedAt, snapshotAt),
      openNumbers.length > 0
        ? notInArray(reviewPull.number, openNumbers)
        : undefined
    );
    await tx
      .update(reviewPull)
      .set({ state: "merged", updatedAt: now })
      .where(departed);

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

  const writePipeline = (
    installationId: number,
    pipeline: Pipeline,
    snapshotAt: Date
  ) =>
    Effect.gen(function* () {
      const now = new Date(yield* Clock.currentTimeMillis);
      yield* Effect.tryPromise(() =>
        db.transaction(async (tx) => {
          for (const flow of pipeline.repos) {
            await writeRepo(tx, installationId, flow, now, snapshotAt);
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
          await writePullRows(tx, installationId, repoId, pull, now, now);
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
   * Drop a closed/merged pull's head cursor. `pull_head` tracks only open pulls
   * as the PR-page freshness signal; leaving a row behind would let a later
   * reuse of the number (or a stray re-delivery) fire a spurious head move.
   */
  const deletePullHead = (owner: string, repo: string, number: number) =>
    Effect.tryPromise(() =>
      db
        .delete(pullHead)
        .where(
          and(
            eq(pullHead.owner, owner),
            eq(pullHead.repo, repo),
            eq(pullHead.number, number)
          )
        )
    ).pipe(
      Effect.orDie,
      Effect.asVoid,
      Effect.withSpan("ReadModelWriter.deletePullHead"),
      Effect.annotateLogs({
        "github.repo": `${owner}/${repo}`,
        "github.pull_number": number,
      })
    );

  /**
   * Wake the PR page for a change that did not move the head sha — a review,
   * label, CI result, or a merge. The head-sha notify only fires on a push, so
   * without this the PR page's live summary would stay stale until reload. The
   * stored head sha (or empty before one is known) rides along so the client's
   * new-commits banner stays accurate: an unchanged sha reads as "no new work".
   */
  const notifyPull = (
    installationId: number,
    owner: string,
    repo: string,
    number: number
  ) =>
    Effect.gen(function* () {
      const rows = yield* Effect.tryPromise(() =>
        db
          .select({ headSha: pullHead.headSha })
          .from(pullHead)
          .where(
            and(
              eq(pullHead.owner, owner),
              eq(pullHead.repo, repo),
              eq(pullHead.number, number)
            )
          )
          .limit(1)
      ).pipe(Effect.orDie);
      const payload = encodePullDirty({
        installationId,
        owner,
        repo,
        number,
        headSha: rows[0]?.headSha ?? "",
      });
      yield* Effect.tryPromise(() =>
        db.execute(sql`SELECT pg_notify(${PULL_DIRTY_CHANNEL}, ${payload})`)
      ).pipe(
        Effect.catchAllCause((cause) =>
          Effect.logWarning("pull notify failed", cause)
        )
      );
    }).pipe(
      Effect.withSpan("ReadModelWriter.notifyPull"),
      Effect.annotateLogs({
        "github.installation": installationId,
        "github.repo": `${owner}/${repo}`,
        "github.pull_number": number,
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

  /**
   * Retire rows nothing reads any more, so three append-only tables don't grow
   * without bound (storage + index bloat that slows the hot reconcile scan).
   * Run from the reconcile leader so it fires once per sweep, not per replica.
   *
   * - `webhook_delivery`: only the last 20 minutes gate reconcile and dedup is
   *   idempotent past that; 48h matches GitHub's own redelivery window.
   * - `workbench_event`: the feed only ever serves the newest ~100/repo.
   * - merged/closed `review_pull`: the dashboard reads `state='open'` only;
   *   child rows cascade. The rail rebuilds promotion history from GitHub, so it
   *   does not depend on these historical rows.
   */
  const prune = Effect.gen(function* () {
    const now = new Date(yield* Clock.currentTimeMillis);
    const deliveryCutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const historyCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    yield* Effect.tryPromise(() =>
      db
        .delete(webhookDelivery)
        .where(lt(webhookDelivery.receivedAt, deliveryCutoff))
    ).pipe(Effect.orDie);
    yield* Effect.tryPromise(() =>
      db
        .delete(workbenchEvent)
        .where(lt(workbenchEvent.occurredAt, historyCutoff))
    ).pipe(Effect.orDie);
    yield* Effect.tryPromise(() =>
      db
        .delete(reviewPull)
        .where(
          and(
            inArray(reviewPull.state, ["merged", "closed"]),
            lt(reviewPull.updatedAt, historyCutoff)
          )
        )
    ).pipe(Effect.orDie);
  }).pipe(
    Effect.catchAllCause((cause) =>
      Effect.logWarning("read-model prune failed", cause)
    ),
    Effect.withSpan("ReadModelWriter.prune")
  );

  return {
    writePipeline,
    writePull,
    writePullHead,
    writeWorkbenchEvents,
    notifyPull,
    deletePullHead,
    prune,
  };
});

export class ReadModelWriter extends Context.Tag(
  "@sphynx/server/ReadModelWriter"
)<ReadModelWriter, Effect.Effect.Success<typeof makeReadModelWriter>>() {}

export const ReadModelWriterLive = Layer.effect(
  ReadModelWriter,
  makeReadModelWriter
);
