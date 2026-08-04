"use node";

import { ConvexError, v } from "convex/values";
import { Effect } from "effect";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { action } from "../_generated/server";
import { authComponent } from "../auth";
import { validateRef, validateText } from "./input";
import { userTokenForRepository } from "./userToken";
import { blockPull, createPull, mergePull } from "./writeQueue";

/** Resolve the installation that owns a repo from the read model. */
async function installationFor(
  ctx: ActionCtx,
  owner: string,
  repo: string
): Promise<number | null> {
  const user = await authComponent.getAuthUser(ctx);
  return await ctx.runQuery(internal.github.access.installationForRepo, {
    userId: user._id,
    owner,
    repo,
  });
}

/**
 * After a user-attributed write lands on GitHub, schedule a read-model refresh
 * for that PR so the dashboard reflects the change ahead of the webhook.
 */
async function afterWrite(
  ctx: ActionCtx,
  owner: string,
  repo: string,
  number: number
) {
  try {
    const installationId = await installationFor(ctx, owner, repo);
    if (installationId !== null) {
      await ctx.scheduler.runAfter(0, internal.github.project.refreshPull, {
        installationId,
        owner,
        repo,
        number,
      });
    }
  } catch (error) {
    console.error("post-write refresh scheduling failed", error);
  }
}

export const merge = action({
  args: {
    owner: v.string(),
    repo: v.string(),
    number: v.number(),
    method: v.optional(v.union(v.literal("squash"), v.literal("merge"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    validateRef(args);
    const token = await userTokenForRepository(ctx, args.owner, args.repo);
    await Effect.runPromise(
      mergePull(
        { owner: args.owner, repo: args.repo, number: args.number },
        token,
        args.method ?? "squash"
      )
    );
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
    validateRef(args);
    validateText("Review body", args.body, 65_536);
    const token = await userTokenForRepository(ctx, args.owner, args.repo);
    await Effect.runPromise(
      blockPull(
        { owner: args.owner, repo: args.repo, number: args.number },
        args.body,
        token
      )
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
    validateText("Owner", args.owner, 100);
    validateText("Repository", args.repo, 100);
    validateText("Source branch", args.from, 255);
    validateText("Target branch", args.to, 255);
    validateText("Pull request title", args.title, 256);
    const token = await userTokenForRepository(ctx, args.owner, args.repo);
    const number = await Effect.runPromise(
      createPull(args.owner, args.repo, args.from, args.to, args.title, token)
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
    const user = await authComponent.getAuthUser(ctx);
    if (
      !(await ctx.runQuery(internal.github.access.canAccessInstallation, {
        userId: user._id,
        installationId: args.installationId,
      }))
    ) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You do not have access to this installation",
      });
    }
    const now = Date.now();
    const userAllowed = await ctx.runMutation(
      internal.github.access.consumeRateLimit,
      {
        key: `${user._id}:resync`,
        limit: 3,
        windowMs: 10 * 60_000,
        now,
      }
    );
    const installationAllowed = await ctx.runMutation(
      internal.github.access.consumeRateLimit,
      {
        key: `installation:${args.installationId}:resync`,
        limit: 1,
        windowMs: 10 * 60_000,
        now,
      }
    );
    if (!(userAllowed && installationAllowed)) {
      throw new ConvexError({
        code: "RATE_LIMITED",
        message: "Too many resync requests; try again later",
      });
    }
    await ctx.runAction(internal.github.materialize.materialize, {
      installationId: args.installationId,
      seed: true,
    });
    return null;
  },
});
