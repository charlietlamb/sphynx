"use node";

import { v } from "convex/values";
import { Effect } from "effect";
import { action } from "../_generated/server";
import { getInstallationToken } from "./installationToken";
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
  handler: async (ctx, args) => {
    const token = await getInstallationToken(
      ctx,
      args.installationId,
      Date.now()
    );
    return await Effect.runPromise(
      searchPulls(args.query, args.limit ?? 30, token)
    );
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
    const token = await getInstallationToken(
      ctx,
      args.installationId,
      Date.now()
    );
    return await Effect.runPromise(
      pullBody(
        { owner: args.owner, repo: args.repo, number: args.number },
        token
      )
    );
  },
});
