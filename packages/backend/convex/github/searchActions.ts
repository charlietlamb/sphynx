"use node";

import { ConvexError, v } from "convex/values";
import { Effect } from "effect";
import { internal } from "../_generated/api";
import { action } from "../_generated/server";
import { authComponent } from "../auth";
import type { QueuePull } from "./domain";
import { validateRef } from "./input";
import { refreshUserAccess } from "./refreshAccess";
import { repoKeyOf } from "./rows";
import { userToken, userTokenForRepository } from "./userToken";
import { queuePullValidator } from "./validators";
import { pullBody, searchPulls } from "./writeQueue";

/** Live GitHub PR search — a passthrough the materialized model cannot answer. */
export const search = action({
  args: {
    installationId: v.number(),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    pulls: v.array(queuePullValidator),
    totalCount: v.number(),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{ pulls: QueuePull[]; totalCount: number }> => {
    const query = args.query.trim();
    const limit = Math.min(Math.max(args.limit ?? 30, 1), 50);
    if (query.length === 0 || query.length > 256) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "Search queries must be between 1 and 256 characters",
      });
    }
    const user = await authComponent.getAuthUser(ctx);
    const token = await userToken(ctx);
    let canAccess = await ctx.runQuery(
      internal.github.access.canAccessInstallation,
      { userId: user._id, installationId: args.installationId }
    );
    if (!canAccess) {
      await refreshUserAccess(ctx, user._id, token);
      canAccess = await ctx.runQuery(
        internal.github.access.canAccessInstallation,
        { userId: user._id, installationId: args.installationId }
      );
    }
    if (!canAccess) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You do not have access to this installation",
      });
    }
    const result = await Effect.runPromise(searchPulls(query, limit, token));
    const grants = new Set(
      await ctx.runQuery(internal.github.access.filterRepositoryKeys, {
        userId: user._id,
        installationId: args.installationId,
        repoKeys: result.pulls.map((pull) =>
          repoKeyOf(args.installationId, pull.owner, pull.repo)
        ),
      })
    );
    const pulls: QueuePull[] = result.pulls.filter((pull) =>
      grants.has(repoKeyOf(args.installationId, pull.owner, pull.repo))
    );
    return { pulls, totalCount: pulls.length };
  },
});

/** A pull request's rendered body HTML, for the dossier. */
export const getPullBody = action({
  args: {
    installationId: v.number(),
    owner: v.string(),
    repo: v.string(),
    number: v.number(),
  },
  returns: v.object({ body: v.union(v.string(), v.null()) }),
  handler: async (ctx, args) => {
    validateRef(args);
    const token = await userTokenForRepository(ctx, args.owner, args.repo);
    return await Effect.runPromise(
      pullBody(
        { owner: args.owner, repo: args.repo, number: args.number },
        token
      )
    );
  },
});
