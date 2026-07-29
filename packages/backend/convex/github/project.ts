"use node";

import { v } from "convex/values";
import { Effect } from "effect";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { internalAction } from "../_generated/server";
import { getInstallationToken } from "./installationToken";
import { refreshPull as refreshPullProgram } from "./pipelineBuilder";
import {
  headCloseFor,
  headMoveFor,
  projectionFor,
  statusTargetFor,
  workbenchTargetFor,
} from "./projection";
import { webhookToWorkbenchEvent } from "./workbenchMappers";

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
  ref: { owner: string; repo: string; number: number },
  now: number
) {
  const claim = await ctx.runMutation(internal.github.refresh.claimRefresh, {
    installationId,
    ...ref,
  });
  if (claim === "queued") {
    return;
  }
  const accessToken = await getInstallationToken(ctx, installationId, now);
  let go = true;
  while (go) {
    const pull = await Effect.runPromise(refreshPullProgram(ref, accessToken));
    if (pull !== null) {
      await ctx.runMutation(internal.github.writer.writePull, {
        installationId,
        owner: ref.owner,
        repo: ref.repo,
        pull,
        snapshotAt: now,
        fetchedAt: Date.now(),
      });
    }
    const next = await ctx.runMutation(
      internal.github.refresh.completeRefresh,
      {
        installationId,
        ...ref,
      }
    );
    go = next === "rerun";
  }
}

async function projectHead(
  ctx: ActionCtx,
  eventType: string,
  payload: unknown
) {
  if (eventType !== "pull_request") {
    return;
  }
  const close = headCloseFor(payload);
  if (close !== null) {
    await ctx.runMutation(internal.github.writer.deletePullHead, close);
    return;
  }
  const move = headMoveFor(payload);
  if (move !== null) {
    await ctx.runMutation(internal.github.writer.writePullHead, move);
  }
}

async function projectStatus(
  ctx: ActionCtx,
  eventType: string,
  payload: unknown,
  now: number
) {
  if (eventType !== "status") {
    return;
  }
  const target = statusTargetFor(payload);
  if (target === null) {
    return;
  }
  const numbers = await ctx.runQuery(
    internal.github.reader.pullNumbersForHead,
    {
      owner: target.owner,
      repo: target.repo,
      headSha: target.sha,
    }
  );
  for (const number of numbers) {
    await projectPull(
      ctx,
      target.installationId,
      { owner: target.owner, repo: target.repo, number },
      now
    );
  }
}

async function projectWorkbench(
  ctx: ActionCtx,
  eventType: string,
  deliveryId: string,
  payload: unknown,
  now: number
) {
  const target = workbenchTargetFor(payload);
  if (target === null) {
    return;
  }
  const event = webhookToWorkbenchEvent(
    target.owner,
    target.repo,
    eventType,
    deliveryId,
    new Date(now).toISOString(),
    payload
  );
  if (event) {
    await ctx.runMutation(internal.github.workbench.writeWorkbenchEvents, {
      events: [
        {
          eventId: event.id,
          installationId: target.installationId,
          owner: target.owner,
          repo: target.repo,
          kind: event.kind,
          actor: event.actor.login,
          actorAvatarUrl: event.actor.avatarUrl || null,
          pullNumber: event.pull?.number ?? null,
          title: event.pull?.title ?? null,
          detail: event.detail,
          url: event.url,
          occurredAt: new Date(event.at).getTime(),
        },
      ],
    });
  }
}

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
    now: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      await projectPull(
        ctx,
        args.installationId,
        { owner: args.owner, repo: args.repo, number: args.number },
        args.now
      );
    } catch (error) {
      console.error("post-write refresh failed", error);
    }
    return null;
  },
});

/**
 * Process one accepted delivery: refresh the affected PR (or backfill on an
 * installation event), maintain the head cursor, resolve legacy commit statuses
 * to PRs, and append the feed event. Failures are swallowed and logged — the
 * reconcile backstop is the repair path for a dropped projection.
 */
export const project = internalAction({
  args: {
    eventType: v.string(),
    deliveryId: v.string(),
    payload: v.any(),
    now: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const projection = projectionFor(args.eventType, args.payload);
      if (projection._tag === "Pull") {
        await projectPull(
          ctx,
          projection.installationId,
          projection.ref,
          args.now
        );
      } else if (projection._tag === "Install") {
        await ctx.runAction(internal.github.materialize.materialize, {
          installationId: projection.installationId,
          now: args.now,
          seed: true,
        });
      }
      await projectStatus(ctx, args.eventType, args.payload, args.now);
      await projectHead(ctx, args.eventType, args.payload);
      await projectWorkbench(
        ctx,
        args.eventType,
        args.deliveryId,
        args.payload,
        args.now
      );
    } catch (error) {
      console.error("webhook projection failed", error);
    }
    return null;
  },
});
