import { Database } from "@sphynx/db/client";
import { githubInstallation } from "@sphynx/db/schema";
import { sql } from "drizzle-orm";
import { Context, Duration, Effect, Layer, Schedule } from "effect";
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

const RECONCILE_INTERVAL = Duration.minutes(3);

/** Repos seeded with feed history at backfill; the rest fill in via webhooks. */
const SEED_REPOS = 10;

const makeMaterializer = Effect.gen(function* () {
  const pipeline = yield* GitHubPipeline;
  const app = yield* GitHubAppAuth;
  const queue = yield* GitHubReviewQueue;
  const writer = yield* ReadModelWriter;
  const db = yield* Database;

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
    Effect.forEach(
      repos.slice(0, SEED_REPOS),
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

  /**
   * Build an installation's full pipeline from GitHub and write it to the read
   * model, and seed the workbench feed. The one place a read of GitHub happens
   * for the dashboard — on backfill and reconcile, never on a user read.
   */
  const materialize = (installationId: number) =>
    Effect.gen(function* () {
      const credential = app.installationCredential(installationId);
      const token = yield* credential.token;
      const discovered = yield* queue.discoverRepos(token);
      const refreshed = yield* pipeline.refresh(token, null);
      if (refreshed._tag === "Modified") {
        yield* writer.writePipeline(installationId, { repos: refreshed.repos });
      }
      yield* seedWorkbench(installationId, discovered, token);
    }).pipe(
      Effect.catchAllCause((cause) =>
        Effect.logWarning("materialize failed", cause)
      ),
      Effect.withSpan("Materializer.materialize"),
      Effect.annotateLogs({ "github.installation": installationId })
    );

  const knownInstallationIds = Effect.tryPromise(() =>
    db
      .select({ installationId: githubInstallation.installationId })
      .from(githubInstallation)
  ).pipe(
    Effect.orDie,
    Effect.map((rows) => rows.map((row) => row.installationId))
  );

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
    const ids = yield* knownInstallationIds;
    yield* Effect.forEach(ids, materialize, { concurrency: 2 });
  }).pipe(
    Effect.withSpan("Materializer.reconcileOnce"),
    Effect.annotateLogs({ reconcile: true })
  );

  /** Run the reconcile sweep forever on a fixed interval, forked as a daemon. */
  const startReconcile = reconcileOnce.pipe(
    Effect.schedule(Schedule.spaced(RECONCILE_INTERVAL)),
    Effect.forkDaemon,
    Effect.asVoid
  );

  return { materialize, reconcileOnce, startReconcile };
});

export class Materializer extends Context.Tag("@sphynx/server/Materializer")<
  Materializer,
  Effect.Effect.Success<typeof makeMaterializer>
>() {}

export const MaterializerLive = Layer.effect(Materializer, makeMaterializer);
