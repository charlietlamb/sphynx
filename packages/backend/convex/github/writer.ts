import { v } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import { internalMutation } from "../_generated/server";
import { shouldApplyPullWrite } from "./gate";
import { gapDocsFrom, pullDocFrom, repoKeyOf } from "./rows";
import { queuePullValidator, repoFlowValidator } from "./validators";

type PullDoc = ReturnType<typeof pullDocFrom>;

/**
 * Apply one pull through the monotonicity gate against the current row. Reads by
 * the deterministic key, applies last-writer-wins + the terminal-state guard,
 * and inserts or patches only when the incoming write wins. Returns whether it
 * was applied. Shared by the per-PR projector write and the full repo rebuild.
 */
async function applyPull(
  ctx: MutationCtx,
  doc: PullDoc,
  snapshotAt: number,
  fetchedAt: number,
): Promise<boolean> {
  const existing = await ctx.db
    .query("reviewPull")
    .withIndex("by_key", (q) => q.eq("key", doc.key))
    .unique();
  const applies = shouldApplyPullWrite(
    existing === null
      ? null
      : {
          state: existing.state,
          ghUpdatedAt: existing.ghUpdatedAt,
          fetchedAt: existing.fetchedAt,
        },
    { state: doc.state, ghUpdatedAt: doc.ghUpdatedAt },
    snapshotAt,
  );
  if (!applies) {
    return false;
  }
  const fields = { ...doc, fetchedAt };
  if (existing === null) {
    await ctx.db.insert("reviewPull", fields);
  } else {
    await ctx.db.patch(existing._id, fields);
  }
  return true;
}

async function ensureRepoRow(
  ctx: MutationCtx,
  installationId: number,
  owner: string,
  repo: string,
  repoKey: string,
  stages?: readonly string[],
) {
  const existing = await ctx.db
    .query("reviewRepo")
    .withIndex("by_key", (q) => q.eq("key", repoKey))
    .unique();
  if (existing === null) {
    await ctx.db.insert("reviewRepo", {
      key: repoKey,
      installationId,
      owner,
      repo,
      defaultBranch: null,
      stages: stages === undefined ? [] : [...stages],
    });
    return;
  }
  if (stages !== undefined) {
    await ctx.db.patch(existing._id, { stages: [...stages] });
  }
}

async function closeDeparted(
  ctx: MutationCtx,
  repoKey: string,
  openNumbers: number[],
  snapshotAt: number,
  now: number,
) {
  const open = new Set(openNumbers);
  const rows = await ctx.db
    .query("reviewPull")
    .withIndex("by_repo_and_state", (q) =>
      q.eq("repoKey", repoKey).eq("state", "open"),
    )
    .collect();
  for (const row of rows) {
    if (row.fetchedAt < snapshotAt && !open.has(row.number)) {
      await ctx.db.patch(row._id, { state: "merged", fetchedAt: now });
    }
  }
}

async function rewriteGaps(
  ctx: MutationCtx,
  repoKey: string,
  installationId: number,
  flow: Parameters<typeof gapDocsFrom>[2],
) {
  const existing = await ctx.db
    .query("stageGap")
    .withIndex("by_repo", (q) => q.eq("repoKey", repoKey))
    .collect();
  await Promise.all(existing.map((row) => ctx.db.delete(row._id)));
  const gaps = gapDocsFrom(installationId, repoKey, flow);
  await Promise.all(gaps.map((gap) => ctx.db.insert("stageGap", gap)));
}

/**
 * Write one repo's full flow: ensure the repo (with stages), apply every open
 * pull through the gate, close departed opens (spared if touched after the
 * snapshot), and rewrite the stage-gap rail. One mutation per repo keeps each
 * transaction well under the write cap on a full installation rebuild.
 */
export const writeRepoFlow = internalMutation({
  args: {
    installationId: v.number(),
    flow: repoFlowValidator,
    snapshotAt: v.number(),
    now: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { flow } = args;
    const repoKey = repoKeyOf(args.installationId, flow.owner, flow.repo);
    await ensureRepoRow(
      ctx,
      args.installationId,
      flow.owner,
      flow.repo,
      repoKey,
      flow.stages,
    );
    for (const pull of flow.openPulls) {
      const doc = pullDocFrom(
        args.installationId,
        repoKey,
        flow.owner,
        flow.repo,
        pull,
      );
      await applyPull(ctx, doc, args.snapshotAt, args.now);
    }
    await closeDeparted(
      ctx,
      repoKey,
      flow.openPulls.map((pull) => pull.number),
      args.snapshotAt,
      args.now,
    );
    await rewriteGaps(ctx, repoKey, args.installationId, flow);
    return null;
  },
});

/**
 * The projector's per-PR write: upsert one pull through the gate without
 * touching the repo's stages (a webhook does not carry them). The repo row is
 * ensured for the parent link; its stages are left to the backfill / rail
 * recompute.
 */
export const writePull = internalMutation({
  args: {
    installationId: v.number(),
    owner: v.string(),
    repo: v.string(),
    pull: queuePullValidator,
    snapshotAt: v.number(),
    fetchedAt: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const repoKey = repoKeyOf(args.installationId, args.owner, args.repo);
    await ensureRepoRow(
      ctx,
      args.installationId,
      args.owner,
      args.repo,
      repoKey,
    );
    const doc = pullDocFrom(
      args.installationId,
      repoKey,
      args.owner,
      args.repo,
      args.pull,
    );
    return await applyPull(ctx, doc, args.snapshotAt, args.fetchedAt);
  },
});

/** Record a PR's head sha, returning whether it actually moved. */
export const writePullHead = internalMutation({
  args: {
    installationId: v.number(),
    owner: v.string(),
    repo: v.string(),
    number: v.number(),
    headSha: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pullHead")
      .withIndex("by_owner_and_repo_and_number", (q) =>
        q.eq("owner", args.owner).eq("repo", args.repo).eq("number", args.number),
      )
      .unique();
    if (existing === null) {
      await ctx.db.insert("pullHead", {
        installationId: args.installationId,
        owner: args.owner,
        repo: args.repo,
        number: args.number,
        headSha: args.headSha,
      });
      return true;
    }
    if (existing.headSha === args.headSha) {
      return false;
    }
    await ctx.db.patch(existing._id, {
      headSha: args.headSha,
      installationId: args.installationId,
    });
    return true;
  },
});

export const deletePullHead = internalMutation({
  args: { owner: v.string(), repo: v.string(), number: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pullHead")
      .withIndex("by_owner_and_repo_and_number", (q) =>
        q.eq("owner", args.owner).eq("repo", args.repo).eq("number", args.number),
      )
      .unique();
    if (existing !== null) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
});
