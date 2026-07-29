import { v } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import { internalQuery, query } from "../_generated/server";
import { toQueuePull, toRepoFlows } from "./readModel";
import { repoKeyOf } from "./rows";
import {
  pipelineValidator,
  queuePullValidator,
  repoFlowValidator,
} from "./validators";

/** Open PR numbers whose head is a given commit sha (status -> PR resolution). */
export const pullNumbersForHead = internalQuery({
  args: { owner: v.string(), repo: v.string(), headSha: v.string() },
  returns: v.array(v.number()),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("pullHead")
      .withIndex("by_owner_and_repo_and_headSha", (q) =>
        q.eq("owner", args.owner).eq("repo", args.repo).eq("headSha", args.headSha),
      )
      .collect();
    return rows.map((row) => row.number);
  },
});

async function openPulls(ctx: QueryCtx, installationId: number) {
  return await ctx.db
    .query("reviewPull")
    .withIndex("by_installation_and_state", (q) =>
      q.eq("installationId", installationId).eq("state", "open"),
    )
    .collect();
}

async function reposFor(ctx: QueryCtx, installationId: number) {
  return await ctx.db
    .query("reviewRepo")
    .withIndex("by_installation", (q) => q.eq("installationId", installationId))
    .collect();
}

/**
 * The dashboard pipeline: open pulls grouped into repo flows with the promotion
 * rail. Live-by-default — any write to the read model repaints subscribers. Pure
 * Convex, never hits GitHub.
 */
export const getPipeline = query({
  args: { installationId: v.number() },
  returns: pipelineValidator,
  handler: async (ctx, args) => {
    const [pulls, repos, gaps] = await Promise.all([
      openPulls(ctx, args.installationId),
      reposFor(ctx, args.installationId),
      ctx.db
        .query("stageGap")
        .withIndex("by_installation", (q) =>
          q.eq("installationId", args.installationId),
        )
        .collect(),
    ]);
    return { repos: toRepoFlows(pulls, repos, gaps) };
  },
});

/** The lighter queue read — open pulls per repo without the promotion rail. */
export const getQueue = query({
  args: { installationId: v.number() },
  returns: v.object({ repos: v.array(repoFlowValidator) }),
  handler: async (ctx, args) => {
    const [pulls, repos] = await Promise.all([
      openPulls(ctx, args.installationId),
      reposFor(ctx, args.installationId),
    ]);
    return { repos: toRepoFlows(pulls, repos, []) };
  },
});

/** One repo's open pulls (used when a quiet repo is selected). */
export const getRepoPulls = query({
  args: { installationId: v.number(), owner: v.string(), repo: v.string() },
  returns: v.array(queuePullValidator),
  handler: async (ctx, args) => {
    const repoKey = repoKeyOf(args.installationId, args.owner, args.repo);
    const pulls = await ctx.db
      .query("reviewPull")
      .withIndex("by_repo_and_state", (q) =>
        q.eq("repoKey", repoKey).eq("state", "open"),
      )
      .collect();
    return pulls.map(toQueuePull);
  },
});

/** The installation that owns a repo, from the read model (no GitHub call). */
export const installationForOwner = query({
  args: { owner: v.string() },
  returns: v.union(v.number(), v.null()),
  handler: async (ctx, args) => {
    const repo = await ctx.db
      .query("reviewRepo")
      .withIndex("by_owner", (q) => q.eq("owner", args.owner))
      .first();
    return repo?.installationId ?? null;
  },
});

const workbenchEventValidator = v.object({
  id: v.string(),
  at: v.string(),
  actor: v.object({ login: v.string(), avatarUrl: v.string() }),
  kind: v.string(),
  pull: v.union(
    v.object({ number: v.number(), title: v.union(v.string(), v.null()) }),
    v.null(),
  ),
  detail: v.union(v.string(), v.null()),
  url: v.union(v.string(), v.null()),
});

/** The workbench feed for a repo — newest first, capped, in the feed shape. */
export const readWorkbench = query({
  args: { installationId: v.number(), owner: v.string(), repo: v.string() },
  returns: v.object({ events: v.array(workbenchEventValidator) }),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("workbenchEvent")
      .withIndex("by_installation_and_repo_and_occurredAt", (q) =>
        q
          .eq("installationId", args.installationId)
          .eq("owner", args.owner)
          .eq("repo", args.repo),
      )
      .order("desc")
      .take(100);
    return {
      events: rows.map((row) => ({
        id: row.eventId,
        at: new Date(row.occurredAt).toISOString(),
        actor: { login: row.actor ?? "", avatarUrl: row.actorAvatarUrl ?? "" },
        kind: row.kind,
        pull:
          row.pullNumber === null
            ? null
            : { number: row.pullNumber, title: row.title },
        detail: row.detail,
        url: row.url,
      })),
    };
  },
});
