"use node";

import { v } from "convex/values";
import { Effect } from "effect";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { internalAction } from "../_generated/server";
import type { RepoFlow } from "./domain";
import { getInstallationToken } from "./installationToken";
import { buildPipeline, discoverRepos, repoEvents } from "./pipelineBuilder";
import { repoKeyOf } from "./rows";
import { toWorkbenchEvents } from "./workbenchMappers";

const SEED_REPOS = 10;
const PULL_WRITE_BATCH = 25;

/**
 * Release the materialization lease this run holds. Delegates to the lease
 * mutation, which — if a later delivery flagged the lease `pending` while this
 * run was in flight — reschedules exactly one fresh materialize so a burst of
 * merges still converges on a clean rebuild instead of orphaning the pending
 * flag. Called on every exit that doesn't reach `complete`.
 */
function releaseLease(
  ctx: ActionCtx,
  installationId: number,
  runId: string,
  seed: boolean
) {
  return ctx.runMutation(internal.github.materializationLease.release, {
    installationId,
    runId,
    seed,
  });
}

/**
 * Seed the workbench feed with recent Events-API history for the first repos.
 * Steady-state feed updates arrive via webhooks; this only runs at backfill /
 * resync. Idempotent on the Events-API id, best-effort per repo.
 */
async function seedWorkbench(
  ctx: ActionCtx,
  installationId: number,
  repos: readonly { owner: string; repo: string }[],
  accessToken: string
) {
  for (const entry of repos.slice(0, SEED_REPOS)) {
    try {
      const raw = await Effect.runPromise(repoEvents(entry, accessToken));
      const events = toWorkbenchEvents(entry.owner, entry.repo, raw);
      if (events.length > 0) {
        await ctx.runMutation(internal.github.workbench.writeWorkbenchEvents, {
          events: events.map((event) => ({
            eventId: event.id,
            installationId,
            owner: entry.owner,
            repo: entry.repo,
            kind: event.kind,
            actor: event.actor.login,
            actorAvatarUrl: event.actor.avatarUrl || null,
            pullNumber: event.pull?.number ?? null,
            title: event.pull?.title ?? null,
            detail: event.detail,
            url: event.url,
            occurredAt: new Date(event.at).getTime(),
          })),
        });
      }
    } catch (error) {
      /** A repo that fails to seed still gets live events going forward. */
      console.warn(
        `workbench seed failed for ${entry.owner}/${entry.repo}`,
        error
      );
    }
  }
}

async function writeFlow(
  ctx: ActionCtx,
  installationId: number,
  flow: RepoFlow,
  snapshotAt: number,
  runId: string
) {
  await ctx.runMutation(internal.github.writer.writeRepoMetadata, {
    installationId,
    owner: flow.owner,
    repo: flow.repo,
    stages: flow.stages,
    gaps: flow.gaps,
    snapshotAt,
    runId,
  });
  for (
    let offset = 0;
    offset < flow.openPulls.length;
    offset += PULL_WRITE_BATCH
  ) {
    await ctx.runMutation(internal.github.writer.writePullBatch, {
      installationId,
      owner: flow.owner,
      repo: flow.repo,
      pulls: flow.openPulls.slice(offset, offset + PULL_WRITE_BATCH),
      snapshotAt,
      fetchedAt: Date.now(),
      runId,
    });
  }
  let more = true;
  while (more) {
    more = await ctx.runMutation(internal.github.writer.finalizeRepo, {
      installationId,
      repoKey: repoKeyOf(installationId, flow.owner, flow.repo),
      snapshotAt,
      now: Date.now(),
      runId,
    });
  }
}

async function retireUndiscovered(
  ctx: ActionCtx,
  installationId: number,
  snapshotAt: number,
  runId: string
) {
  let repoKeys: string[];
  do {
    repoKeys = await ctx.runMutation(
      internal.github.writer.claimUndiscoveredRepos,
      { installationId, snapshotAt, runId }
    );
    for (const repoKey of repoKeys) {
      let more = true;
      while (more) {
        more = await ctx.runMutation(internal.github.writer.retireRepo, {
          installationId,
          repoKey,
          snapshotAt,
          now: Date.now(),
          runId,
        });
      }
    }
  } while (repoKeys.length > 0);
}

/**
 * Build an installation's full pipeline from GitHub and write it to the read
 * model, one repo per mutation to stay under the write cap. `snapshotAt` is
 * stamped before touching GitHub so a webhook opening a PR mid-fetch is not
 * clobbered as merged. Never reuses a persisted ETag — a full read every time.
 */
export const materialize = internalAction({
  args: {
    installationId: v.number(),
    seed: v.boolean(),
    now: v.optional(v.number()),
  },
  returns: v.object({ repoCount: v.number() }),
  handler: async (ctx, args): Promise<{ repoCount: number }> => {
    if (
      await ctx.runQuery(internal.github.reconcile.isRetired, {
        installationId: args.installationId,
      })
    ) {
      return { repoCount: 0 };
    }
    const runId = crypto.randomUUID();
    const claim = await ctx.runMutation(
      internal.github.materializationLease.claim,
      {
        installationId: args.installationId,
        now: Date.now(),
        runId,
        seed: args.seed,
      }
    );
    if (claim === "queued") {
      return { repoCount: 0 };
    }
    let repoCount = 0;
    try {
      const snapshotAt = Date.now();
      const accessToken = await getInstallationToken(
        ctx,
        args.installationId,
        snapshotAt
      );
      const pipeline = await Effect.runPromise(buildPipeline(accessToken));
      for (const flow of pipeline.repos) {
        await writeFlow(ctx, args.installationId, flow, snapshotAt, runId);
        const renewed = await ctx.runMutation(
          internal.github.materializationLease.renew,
          { installationId: args.installationId, now: Date.now(), runId }
        );
        // The lease was stolen (expired and re-claimed by a newer run). That run
        // owns the rebuild now, so stop — but release so any `pending` flag it
        // carries still reschedules one final clean run.
        if (!renewed) {
          await releaseLease(ctx, args.installationId, runId, args.seed);
          return { repoCount };
        }
      }
      await retireUndiscovered(ctx, args.installationId, snapshotAt, runId);
      if (
        !(await ctx.runMutation(internal.github.materializationLease.renew, {
          installationId: args.installationId,
          now: Date.now(),
          runId,
        }))
      ) {
        await releaseLease(ctx, args.installationId, runId, args.seed);
        return { repoCount };
      }
      if (args.seed) {
        const discovered = await Effect.runPromise(discoverRepos(accessToken));
        await seedWorkbench(ctx, args.installationId, discovered, accessToken);
      }
      repoCount = pipeline.repos.length;
      const finishedAt = Date.now();
      const completion = await ctx.runMutation(
        internal.github.materializationLease.complete,
        { installationId: args.installationId, now: finishedAt, runId }
      );
      if (completion !== "lost") {
        await ctx.runMutation(internal.github.reconcile.markInstallation, {
          installationId: args.installationId,
          reconciledAt: finishedAt,
        });
      }
    } catch (error) {
      await releaseLease(ctx, args.installationId, runId, args.seed);
      throw error;
    }
    return { repoCount };
  },
});
