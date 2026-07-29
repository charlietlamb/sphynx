"use node";

import { Effect } from "effect";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { action } from "../_generated/server";
import {
  blockPull,
  createPull,
  mergePull,
  searchPulls as searchPullsProgram,
} from "./writeQueue";
import { userToken } from "./userToken";
import { queuePullValidator } from "./validators";

async function installationToken(
  ctx: ActionCtx,
  installationId: number,
): Promise<string> {
  return await ctx.runAction(internal.github.appAuth.installationToken, {
    installationId,
    now: Date.now(),
  });
}

/**
 * After a write lands on GitHub, refresh the affected PR into the read model so
 * the dashboard reflects it without waiting for the webhook. The write itself is
 * attributed to the user; this refresh reads as the installation.
 */
async function refreshAfterWrite(
  ctx: ActionCtx,
  installationId: number,
  owner: string,
  repo: string,
  number: number,
) {
  await ctx.scheduler.runAfter(0, internal.github.project.project, {
    eventType: "pull_request",
    deliveryId: `write:${installationId}:${owner}/${repo}#${number}:${Date.now()}`,
    payload: {
      installation: { id: installationId },
      repository: { name: repo, owner: { login: owner } },
      pull_request: { number },
    },
    now: Date.now(),
  });
}

export const merge = action({
  args: {
    installationId: v.number(),
    owner: v.string(),
    repo: v.string(),
    number: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const token = await userToken(ctx);
    await Effect.runPromise(
      mergePull(
        { owner: args.owner, repo: args.repo, number: args.number },
        token,
      ),
    );
    await refreshAfterWrite(
      ctx,
      args.installationId,
      args.owner,
      args.repo,
      args.number,
    );
    return null;
  },
});

export const block = action({
  args: {
    installationId: v.number(),
    owner: v.string(),
    repo: v.string(),
    number: v.number(),
    body: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const token = await userToken(ctx);
    await Effect.runPromise(
      blockPull(
        { owner: args.owner, repo: args.repo, number: args.number },
        args.body,
        token,
      ),
    );
    await refreshAfterWrite(
      ctx,
      args.installationId,
      args.owner,
      args.repo,
      args.number,
    );
    return null;
  },
});

export const promote = action({
  args: {
    installationId: v.number(),
    owner: v.string(),
    repo: v.string(),
    from: v.string(),
    to: v.string(),
    title: v.string(),
  },
  returns: v.object({ number: v.number() }),
  handler: async (ctx, args) => {
    const token = await userToken(ctx);
    const number = await Effect.runPromise(
      createPull(
        args.owner,
        args.repo,
        args.from,
        args.to,
        args.title,
        token,
      ),
    );
    await refreshAfterWrite(
      ctx,
      args.installationId,
      args.owner,
      args.repo,
      number,
    );
    return { number };
  },
});

/** Live GitHub PR search — a passthrough the materialized model cannot answer. */
export const searchPulls = action({
  args: {
    installationId: v.number(),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    pulls: v.array(queuePullValidator),
    totalCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const token = await installationToken(ctx, args.installationId);
    return await Effect.runPromise(
      searchPullsProgram(args.query, args.limit ?? 30, token),
    );
  },
});
