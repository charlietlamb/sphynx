import { Database } from "@sphynx/db/client";
import { githubInstallation, webhookDelivery } from "@sphynx/db/schema";
import { and, eq, gt, isNotNull, sql } from "drizzle-orm";
import { Clock, Context, Deferred, Duration, Effect, Layer, Ref } from "effect";
import { GitHubAppAuth } from "./app-auth";
import { GitHubPipeline } from "./pipeline";
import { workbenchEventRow } from "./read-model-rows";
import { ReadModelWriter } from "./read-model-writer";
import { GitHubReviewQueue } from "./review-queue";
import { toWorkbenchEvents } from "./workbench-mappers";

/**
 * The advisory-lock key for the reconcile leader. A single arbitrary 64-bit
 * constant: whichever instance holds it runs the sweep, the rest skip it, so
 * multiple containers do not reconcile the same installations at once.
 */
const RECONCILE_LOCK = 8_273_610_411;

/**
 * An installation that received a webhook within this window is already fresh,
 * so reconcile skips it — it only sweeps the quiet installs a missed delivery
 * could have left stale.
 */
const RECENT_WEBHOOK_WINDOW = Duration.minutes(20);

/** Repos seeded with feed history at backfill; the rest fill in via webhooks. */
const SEED_REPOS = 10;

const makeMaterializer = Effect.gen(function* () {
  const pipeline = yield* GitHubPipeline;
  const app = yield* GitHubAppAuth;
  const queue = yield* GitHubReviewQueue;
  const writer = yield* ReadModelWriter;
  const db = yield* Database;
  const inFlight = yield* Ref.make(new Map<number, Deferred.Deferred<void>>());

  /**
   * Seed the workbench feed with recent history from the Events API. Only runs
   * at backfill/resync — steady-state feed updates arrive via webhooks. Rows
   * are idempotent on the Events-API id, so re-seeding is safe. Best-effort:
   * a repo that fails to seed still gets live events going forward.
   */
  const seedWorkbench = (
    installationId: number,
    repos: readonly { owner: string; repo: string }[],
    token: string
  ) =>
    Effect.gen(function* () {
      const seeded = repos.slice(0, SEED_REPOS);
      if (repos.length > SEED_REPOS) {
        yield* Effect.logInfo(
          `workbench seed covers ${SEED_REPOS} of ${repos.length} repos; the rest fill in from webhooks`
        );
      }
      yield* seedRepos(installationId, seeded, token);
    }).pipe(
      Effect.withSpan("Materializer.seedWorkbench"),
      Effect.annotateLogs({ "github.installation": installationId })
    );

  const seedRepos = (
    installationId: number,
    repos: readonly { owner: string; repo: string }[],
    token: string
  ) =>
    Effect.forEach(
      repos,
      (entry) =>
        queue.repoEvents(entry, token).pipe(
          Effect.map((raw) => toWorkbenchEvents(entry.owner, entry.repo, raw)),
          Effect.flatMap((events) =>
            writer.writeWorkbenchEvents(
              installationId,
              events.map((event) =>
                workbenchEventRow(
                  installationId,
                  entry.owner,
                  entry.repo,
                  event
                )
              )
            )
          ),
          Effect.catchAllCause((cause) =>
            Effect.logWarning("workbench seed failed for repo", cause)
          )
        ),
      { concurrency: 3, discard: true }
    );

  /** The stored composite ETag for an installation, or null before first build. */
  const storedEtag = (installationId: number) =>
    Effect.tryPromise(() =>
      db
        .select({ etag: githubInstallation.pipelineEtag })
        .from(githubInstallation)
        .where(eq(githubInstallation.installationId, installationId))
        .limit(1)
    ).pipe(
      Effect.orDie,
      Effect.map((rows) => rows[0]?.etag ?? null)
    );

  const rememberEtag = (installationId: number, etag: string, now: Date) =>
    Effect.tryPromise(() =>
      db
        .update(githubInstallation)
        .set({ pipelineEtag: etag, reconciledAt: now })
        .where(eq(githubInstallation.installationId, installationId))
    ).pipe(Effect.orDie);

  /**
   * `seed` requests a workbench backfill from the Events API — only wanted on a
   * cold install or an explicit resync. The periodic reconcile passes `false`:
   * webhooks already stream feed events, so re-pulling the Events API every
   * sweep is pure waste (the writes are idempotent no-ops).
   */
  const materializeOnce = (installationId: number, seed: boolean) =>
    Effect.gen(function* () {
      const credential = app.installationCredential(installationId);
      const token = yield* credential.token;
      /**
       * Stamp the snapshot start before touching GitHub. `writePipeline` only
       * marks-merged pulls untouched since this instant, so a webhook that opens
       * a PR while the (slow) fetch runs is never clobbered as merged.
       */
      const snapshotAt = new Date(yield* Clock.currentTimeMillis);
      /**
       * Reuse the last composite ETag so an unchanged installation revalidates
       * as `NotModified` — cheap authorized 304s that skip the whole per-repo
       * compare fan-out — instead of a full refetch every sweep.
       */
      const previousEtag = yield* storedEtag(installationId);
      const refreshed = yield* pipeline.refresh(token, previousEtag);
      if (refreshed._tag === "Modified") {
        yield* writer.writePipeline(
          installationId,
          { repos: refreshed.repos },
          snapshotAt
        );
        yield* rememberEtag(installationId, refreshed.etag, snapshotAt);
      }
      if (seed) {
        const discovered = yield* queue.discoverRepos(token);
        yield* seedWorkbench(installationId, discovered, token);
      }
    }).pipe(
      Effect.catchAllCause((cause) =>
        Effect.logWarning("materialize failed", cause)
      )
    );

  /**
   * Build an installation's full pipeline from GitHub and write it to the read
   * model, and seed the workbench feed. The one place a read of GitHub happens
   * for the dashboard — on backfill, reconcile, and cold-read, never on a warm
   * user read.
   *
   * Single-flighted per installation: concurrent cold reads (a dashboard fires
   * getPipeline + getQueue together, and several users can land at once) share
   * one build instead of each triggering a full GitHub rebuild.
   */
  const materialize = (installationId: number, seed = true) =>
    Effect.gen(function* () {
      const latch = yield* Deferred.make<void>();
      /**
       * Atomically claim leadership: install our latch only if none is present.
       * The follower gets back the existing latch and awaits it; exactly one
       * fiber runs the build per installation.
       */
      const leader = yield* Ref.modify(inFlight, (map) => {
        const running = map.get(installationId);
        if (running) {
          return [running, map] as const;
        }
        return [null, new Map(map).set(installationId, latch)] as const;
      });
      if (leader) {
        return yield* Deferred.await(leader);
      }
      yield* materializeOnce(installationId, seed).pipe(
        Effect.ensuring(
          Ref.update(inFlight, (map) => {
            const next = new Map(map);
            next.delete(installationId);
            return next;
          }).pipe(Effect.zipRight(Deferred.succeed(latch, undefined)))
        )
      );
    }).pipe(
      Effect.withSpan("Materializer.materialize"),
      Effect.annotateLogs({ "github.installation": installationId })
    );

  /**
   * Installations that reconcile should sweep: every known install *except*
   * those that received a webhook within `RECENT_WEBHOOK_WINDOW`. A
   * webhook-active install is already live via the projector, so re-deriving it
   * from GitHub would only repeat work the webhook just did.
   */
  const staleInstallationIds = (now: Date) => {
    const cutoff = new Date(
      now.getTime() - Duration.toMillis(RECENT_WEBHOOK_WINDOW)
    );
    const recentlyActive = db
      .select({ installationId: webhookDelivery.installationId })
      .from(webhookDelivery)
      .where(
        and(
          isNotNull(webhookDelivery.installationId),
          gt(webhookDelivery.receivedAt, cutoff)
        )
      );
    return Effect.tryPromise(() =>
      db
        .select({ installationId: githubInstallation.installationId })
        .from(githubInstallation)
        .where(
          sql`${githubInstallation.installationId} NOT IN (${recentlyActive})`
        )
    ).pipe(
      Effect.orDie,
      Effect.map((rows) => rows.map((row) => row.installationId))
    );
  };

  /**
   * Try to claim tick leadership on a single pinned connection.
   *
   * `pg_try_advisory_lock` + its unlock must run on the SAME connection — a
   * session lock released on a different pooled connection than it was taken on
   * silently leaks. `db.transaction` pins one pooled connection for the
   * callback, so acquire, release, and the guard all share it. The lock is held
   * only for this fast check, not across the slow sweep, so no DB transaction
   * stays open while GitHub is called.
   *
   * Returns true at most once per tick across all instances; the others skip.
   * A crashed leader's lock frees when its connection resets.
   */
  const claimLeadership = Effect.tryPromise(() =>
    db.transaction(async (tx) => {
      const claim = await tx.execute(
        sql`SELECT pg_try_advisory_lock(${RECONCILE_LOCK}) AS locked`
      );
      const locked = (claim.rows as { locked?: boolean }[])[0]?.locked === true;
      if (locked) {
        await tx.execute(sql`SELECT pg_advisory_unlock(${RECONCILE_LOCK})`);
      }
      return locked;
    })
  ).pipe(
    Effect.catchAllCause((cause) =>
      Effect.logWarning("reconcile leadership check failed", cause).pipe(
        Effect.as(false)
      )
    )
  );

  /**
   * Reconcile every known installation once. Leadership dedupes concurrent
   * instances, but write idempotency (watermarked upserts) is the real
   * guarantee, so a rare overlapping sweep only wastes work — it cannot move
   * state backwards.
   */
  const reconcileOnce = Effect.gen(function* () {
    if (!(yield* claimLeadership)) {
      return;
    }
    const now = new Date(yield* Clock.currentTimeMillis);
    const ids = yield* staleInstallationIds(now);
    yield* Effect.forEach(ids, (id) => materialize(id, false), {
      concurrency: 2,
    });
  }).pipe(
    Effect.withSpan("Materializer.reconcileOnce"),
    Effect.annotateLogs({ reconcile: true })
  );

  return { materialize, reconcileOnce };
});

export class Materializer extends Context.Tag("@sphynx/server/Materializer")<
  Materializer,
  Effect.Effect.Success<typeof makeMaterializer>
>() {}

export const MaterializerLive = Layer.effect(Materializer, makeMaterializer);
