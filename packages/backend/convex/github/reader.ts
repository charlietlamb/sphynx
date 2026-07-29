import { v } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import { internalQuery, query } from "../_generated/server";
import {
  grantedInstallationForRepo,
  repositoryKeysForInstallation,
  requireRepository,
  requireUser,
} from "./access";
import { MAX_INSTALLATION_REPOSITORIES, MAX_PIPELINE_PULLS } from "./limits";
import { toRepoFlows } from "./readModel";
import { pipelineValidator, workbenchEventKindValidator } from "./validators";

const MAX_HEAD_MATCHES = 100;
const MAX_STAGE_GAPS = 150;

function withinLimit<T>(rows: T[], limit: number, resource: string) {
  if (rows.length > limit) {
    throw new Error(`${resource} exceeds the supported ${limit}-row limit`);
  }
  return rows;
}

/** Open PR numbers whose head is a given commit sha (status -> PR resolution). */
export const pullNumbersForHead = internalQuery({
  args: {
    installationId: v.number(),
    owner: v.string(),
    repo: v.string(),
    headSha: v.string(),
  },
  returns: v.array(v.number()),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("pullHead")
      .withIndex("by_installation_and_owner_and_repo_and_headSha", (q) =>
        q
          .eq("installationId", args.installationId)
          .eq("owner", args.owner.toLowerCase())
          .eq("repo", args.repo.toLowerCase())
          .eq("headSha", args.headSha)
      )
      .take(MAX_HEAD_MATCHES + 1);
    return withinLimit(rows, MAX_HEAD_MATCHES, "Head matches").map(
      (row) => row.number
    );
  },
});

async function openPulls(ctx: QueryCtx, installationId: number) {
  const rows = await ctx.db
    .query("reviewPull")
    .withIndex("by_installation_and_state", (q) =>
      q.eq("installationId", installationId).eq("state", "open")
    )
    .take(MAX_PIPELINE_PULLS + 1);
  return withinLimit(rows, MAX_PIPELINE_PULLS, "Installation pull queue");
}

async function reposFor(ctx: QueryCtx, installationId: number) {
  const rows = await ctx.db
    .query("reviewRepo")
    .withIndex("by_installation", (q) => q.eq("installationId", installationId))
    .take(MAX_INSTALLATION_REPOSITORIES + 1);
  return withinLimit(
    rows,
    MAX_INSTALLATION_REPOSITORIES,
    "Installation repositories"
  );
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
    const allowed = await repositoryKeysForInstallation(
      ctx,
      args.installationId
    );
    const [pulls, repos, gapRows] = await Promise.all([
      openPulls(ctx, args.installationId),
      reposFor(ctx, args.installationId),
      ctx.db
        .query("stageGap")
        .withIndex("by_installation", (q) =>
          q.eq("installationId", args.installationId)
        )
        .take(MAX_STAGE_GAPS + 1),
    ]);
    const gaps = withinLimit(gapRows, MAX_STAGE_GAPS, "Pipeline stage gaps");
    return {
      repos: toRepoFlows(
        pulls.filter((pull) => allowed.has(pull.repoKey)),
        repos.filter((repo) => allowed.has(repo.key)),
        gaps.filter((gap) => allowed.has(gap.repoKey))
      ),
    };
  },
});

/** The active installation grant for a repo (no GitHub call). */
export const installationForOwner = query({
  args: { owner: v.string(), repo: v.string() },
  returns: v.union(v.number(), v.null()),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return await grantedInstallationForRepo(
      ctx,
      user._id,
      args.owner,
      args.repo
    );
  },
});

const workbenchEventValidator = v.object({
  id: v.string(),
  at: v.string(),
  actor: v.object({ login: v.string(), avatarUrl: v.string() }),
  kind: workbenchEventKindValidator,
  pull: v.union(
    v.object({ number: v.number(), title: v.union(v.string(), v.null()) }),
    v.null()
  ),
  detail: v.union(v.string(), v.null()),
  url: v.union(v.string(), v.null()),
});

/** The workbench feed for a repo — newest first, capped, in the feed shape. */
export const readWorkbench = query({
  args: { installationId: v.number(), owner: v.string(), repo: v.string() },
  returns: v.object({ events: v.array(workbenchEventValidator) }),
  handler: async (ctx, args) => {
    await requireRepository(ctx, args.installationId, args.owner, args.repo);
    const rows = await ctx.db
      .query("workbenchEvent")
      .withIndex("by_installation_and_repo_and_occurredAt", (q) =>
        q
          .eq("installationId", args.installationId)
          .eq("owner", args.owner.toLowerCase())
          .eq("repo", args.repo.toLowerCase())
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
