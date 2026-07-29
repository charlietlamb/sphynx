"use node";

import { Effect } from "effect";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { action } from "../_generated/server";
import { blockPull, createPull, mergePull } from "./writeQueue";
import { userToken } from "./userToken";

/** Resolve the installation that owns a repo from the read model. */
async function installationFor(
  ctx: ActionCtx,
  owner: string,
): Promise<number | null> {
  return await ctx.runQuery(api.github.reader.installationForOwner, { owner });
}

/**
 * After a user-attributed write lands on GitHub, schedule a read-model refresh
 * for that PR so the dashboard reflects the change ahead of the webhook.
 */
async function afterWrite(
  ctx: ActionCtx,
  owner: string,
  repo: string,
  number: number,
) {
  const installationId = await installationFor(ctx, owner);
  if (installationId !== null) {
    await ctx.scheduler.runAfter(0, internal.github.project.refreshPull, {
      installationId,
      owner,
      repo,
      number,
      now: Date.now(),
    });
  }
}

export const merge = action({
  args: { owner: v.string(), repo: v.string(), number: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const token = await userToken(ctx);
    await Effect.runPromise(mergePull(args, token));
    await afterWrite(ctx, args.owner, args.repo, args.number);
    return null;
  },
});

export const block = action({
  args: {
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
    await afterWrite(ctx, args.owner, args.repo, args.number);
    return null;
  },
});

export const promote = action({
  args: {
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
      createPull(args.owner, args.repo, args.from, args.to, args.title, token),
    );
    await afterWrite(ctx, args.owner, args.repo, number);
    return { number };
  },
});

/** Rebuild an installation's read model from GitHub on demand. */
export const resync = action({
  args: { installationId: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runAction(internal.github.materialize.materialize, {
      installationId: args.installationId,
      now: Date.now(),
      seed: true,
    });
    return null;
  },
});
