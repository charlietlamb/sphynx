"use node";

import { v } from "convex/values";
import { Effect } from "effect";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { internalAction } from "../_generated/server";
import { getInstallationToken } from "./installationToken";
import { refreshPull as refreshPullProgram } from "./pipelineBuilder";
import { normalizeWebhookJob, type WebhookJob } from "./webhookJob";

/**
 * Refresh one PR from GitHub and write it through the gate, coalescing a burst
 * for the same PR. The pullRefresh claim-mutation is the serialization point:
 * the first delivery runs, later deliveries flag `pending`, and the runner loops
 * once more to capture the latest state — the stateless equivalent of the source
 * server's in-process running/pending Ref sets.
 */
async function projectPull(
  ctx: ActionCtx,
  installationId: number,
  ref: { owner: string; repo: string; number: number }
) {
  const runId = crypto.randomUUID();
  const claim = await ctx.runMutation(internal.github.refresh.claimRefresh, {
    installationId,
    ...ref,
    now: Date.now(),
    runId,
  });
  if (claim === "queued") {
    return;
  }
  try {
    const accessToken = await getInstallationToken(
      ctx,
      installationId,
      Date.now()
    );
    let go = true;
    while (go) {
      const snapshotAt = Date.now();
      const pull = await Effect.runPromise(
        refreshPullProgram(ref, accessToken)
      );
      const fetchedAt = Date.now();
      if (pull !== null) {
        await ctx.runMutation(internal.github.writer.writePull, {
          installationId,
          owner: ref.owner,
          repo: ref.repo,
          pull,
          snapshotAt,
          fetchedAt,
        });
      }
      const next = await ctx.runMutation(
        internal.github.refresh.completeRefresh,
        {
          installationId,
          ...ref,
          now: fetchedAt,
          runId,
        }
      );
      go = next === "rerun";
    }
  } catch (error) {
    await ctx.runMutation(internal.github.refresh.releaseRefresh, {
      installationId,
      ...ref,
      runId,
    });
    throw error;
  }
}

async function executeJob(ctx: ActionCtx, job: WebhookJob) {
  if (job.projection.kind === "pull") {
    await projectPull(ctx, job.projection.installationId, job.projection.ref);
  } else if (job.projection.kind === "pulls") {
    for (const ref of job.projection.refs) {
      await projectPull(ctx, job.projection.installationId, ref);
    }
  } else if (job.projection.kind === "install") {
    await ctx.runMutation(internal.github.reconcile.restoreInstallation, {
      installationId: job.projection.installationId,
    });
    await ctx.runAction(internal.github.materialize.materialize, {
      installationId: job.projection.installationId,
      seed: true,
    });
  } else if (job.projection.kind === "retire") {
    await ctx.runMutation(internal.github.reconcile.retireInstallation, {
      installationId: job.projection.installationId,
      retiredAt: Date.now(),
    });
  }
  const target = job.status;
  if (target) {
    const numbers = await ctx.runQuery(
      internal.github.reader.pullNumbersForHead,
      {
        installationId: target.installationId,
        owner: target.owner,
        repo: target.repo,
        headSha: target.sha,
      }
    );
    for (const number of numbers) {
      await projectPull(ctx, target.installationId, {
        owner: target.owner,
        repo: target.repo,
        number,
      });
    }
  }
  if (job.headClose) {
    await ctx.runMutation(internal.github.writer.deletePullHead, job.headClose);
  } else if (job.headMove) {
    await ctx.runMutation(internal.github.writer.writePullHead, job.headMove);
  }
  if (job.workbench) {
    await ctx.runMutation(internal.github.workbench.writeWorkbenchEvents, {
      events: [job.workbench],
    });
  }
}

const syncsQueue = (job: WebhookJob) =>
  job.projection.kind !== "none" ||
  job.status !== null ||
  job.headClose !== null ||
  job.headMove !== null;

/**
 * Refresh a single PR into the read model — the after-a-write path. A write
 * (merge/block/promote) schedules this so the dashboard reflects the change
 * ahead of the webhook, without fabricating a webhook envelope.
 */
export const refreshPull = internalAction({
  args: {
    installationId: v.number(),
    owner: v.string(),
    repo: v.string(),
    number: v.number(),
    attempt: v.optional(v.number()),
    now: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      await projectPull(ctx, args.installationId, {
        owner: args.owner,
        repo: args.repo,
        number: args.number,
      });
    } catch (error) {
      const attempt = args.attempt ?? 0;
      if (attempt < 3) {
        await ctx.scheduler.runAfter(
          2 ** attempt * 1000,
          internal.github.project.refreshPull,
          { ...args, attempt: attempt + 1 }
        );
      } else {
        console.error("post-write refresh failed after retries", error);
      }
    }
    return null;
  },
});

/**
 * Process one accepted delivery: refresh the affected PR (or backfill on an
 * installation event), maintain the head cursor, resolve legacy commit statuses
 * to PRs, and append the feed event. Scheduled actions are at-most-once, so
 * transient failures explicitly reschedule before the reconcile backstop.
 */
export const project = internalAction({
  args: {
    deliveryId: v.string(),
    eventType: v.optional(v.string()),
    payload: v.optional(v.any()),
    now: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.eventType !== undefined && args.payload !== undefined) {
      const now = args.now ?? Date.now();
      await ctx.runMutation(internal.github.ingest.recordDelivery, {
        deliveryId: args.deliveryId,
        eventType: args.eventType,
        receivedAt: now,
        job: normalizeWebhookJob(
          args.eventType,
          args.deliveryId,
          args.payload,
          now
        ),
      });
    }
    const claimed = await ctx.runMutation(
      internal.github.ingest.claimDelivery,
      { deliveryId: args.deliveryId, now: Date.now() }
    );
    if (!claimed) {
      return null;
    }
    try {
      await executeJob(ctx, claimed.job);
      await ctx.runMutation(internal.github.ingest.completeDelivery, {
        deliveryId: args.deliveryId,
        attempt: claimed.attempt,
        syncedAt: syncsQueue(claimed.job) ? Date.now() : null,
      });
    } catch (error) {
      await ctx.runMutation(internal.github.ingest.retryDelivery, {
        deliveryId: args.deliveryId,
        attempt: claimed.attempt,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return null;
  },
});
