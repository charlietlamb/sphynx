import { Database } from "@sphynx/db/client";
import { githubInstallation } from "@sphynx/db/schema";
import { Context, Duration, Effect, Layer, Schedule } from "effect";
import { GitHubAppAuth } from "./app-auth";
import { GitHubPipeline } from "./pipeline";
import { ReadModelWriter } from "./read-model-writer";

/**
 * The advisory-lock key for the reconcile leader. A single arbitrary 64-bit
 * constant: whichever instance holds it runs the sweep, the rest skip it, so
 * multiple containers do not reconcile the same installations at once.
 */
const RECONCILE_LOCK = 8_273_610_411;

const RECONCILE_INTERVAL = Duration.minutes(3);

const makeMaterializer = Effect.gen(function* () {
  const pipeline = yield* GitHubPipeline;
  const app = yield* GitHubAppAuth;
  const writer = yield* ReadModelWriter;
  const db = yield* Database;

  /**
   * Build an installation's full pipeline from GitHub and write it to the read
   * model. The one place a read of GitHub happens for the dashboard — on
   * backfill and reconcile, never on a user read.
   */
  const materialize = (installationId: number) =>
    Effect.gen(function* () {
      const credential = app.installationCredential(installationId);
      const token = yield* credential.token;
      const refreshed = yield* pipeline.refresh(token, null);
      if (refreshed._tag === "NotModified") {
        return;
      }
      yield* writer.writePipeline(installationId, { repos: refreshed.repos });
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
   * Try to become the reconcile leader for this tick. `pg_try_advisory_lock`
   * is non-blocking: exactly one instance gets true, the others get false and
   * skip. The lock is session-scoped and released when the connection returns,
   * so a crashed leader frees it automatically.
   */
  const acquireLeader = Effect.tryPromise(() =>
    db.execute(`SELECT pg_try_advisory_lock(${RECONCILE_LOCK}) AS locked`)
  ).pipe(
    Effect.map((result) => {
      const rows = result.rows as { locked?: boolean }[];
      return rows[0]?.locked === true;
    }),
    Effect.catchAllCause((cause) =>
      Effect.logWarning("advisory lock failed", cause).pipe(Effect.as(false))
    )
  );

  const releaseLeader = Effect.tryPromise(() =>
    db.execute(`SELECT pg_advisory_unlock(${RECONCILE_LOCK})`)
  ).pipe(Effect.ignore);

  const reconcileOnce = Effect.gen(function* () {
    const leader = yield* acquireLeader;
    if (!leader) {
      return;
    }
    const ids = yield* knownInstallationIds;
    yield* Effect.forEach(ids, materialize, { concurrency: 2 });
    yield* releaseLeader;
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
