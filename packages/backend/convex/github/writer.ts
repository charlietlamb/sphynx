import { v } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import { internalMutation } from "../_generated/server";
import { shouldApplyPullWrite } from "./gate";
import {
  isInstallationRetired,
  ownsMaterializationRun,
} from "./installationState";
import { MAX_PULL_DOCUMENT_BYTES } from "./limits";
import { gapDocsFrom, pullDocFrom, repoKeyOf } from "./rows";
import { queuePullValidator, stageGapValidator } from "./validators";

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
  presenceSeenAt?: number
): Promise<boolean> {
  const bytes = new TextEncoder().encode(JSON.stringify(doc)).byteLength;
  if (bytes > MAX_PULL_DOCUMENT_BYTES) {
    throw new Error(
      `Pull ${doc.key} exceeds the ${MAX_PULL_DOCUMENT_BYTES}-byte read-model limit`
    );
  }
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
    snapshotAt
  );
  if (!applies) {
    if (
      existing?.state === "open" &&
      presenceSeenAt !== undefined &&
      (existing.presenceSeenAt === undefined ||
        existing.presenceSeenAt < presenceSeenAt)
    ) {
      await ctx.db.patch("reviewPull", existing._id, { presenceSeenAt });
    }
    return false;
  }
  const fields = {
    ...doc,
    fetchedAt,
    presenceSeenAt:
      presenceSeenAt === undefined
        ? existing?.presenceSeenAt
        : Math.max(existing?.presenceSeenAt ?? presenceSeenAt, presenceSeenAt),
  };
  if (existing === null) {
    await ctx.db.insert("reviewPull", fields);
  } else {
    await ctx.db.patch("reviewPull", existing._id, fields);
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
  presenceSeenAt?: number
): Promise<boolean> {
  const normalizedOwner = owner.toLowerCase();
  const normalizedRepo = repo.toLowerCase();
  const existing = await ctx.db
    .query("reviewRepo")
    .withIndex("by_key", (q) => q.eq("key", repoKey))
    .unique();
  if (existing === null) {
    await ctx.db.insert("reviewRepo", {
      key: repoKey,
      installationId,
      owner: normalizedOwner,
      repo: normalizedRepo,
      defaultBranch: null,
      stages: stages === undefined ? [] : [...stages],
      presenceSeenAt,
    });
    return true;
  }
  if (
    presenceSeenAt !== undefined &&
    existing.presenceSeenAt !== undefined &&
    existing.presenceSeenAt > presenceSeenAt
  ) {
    return false;
  }
  if (stages !== undefined || presenceSeenAt !== undefined) {
    await ctx.db.patch("reviewRepo", existing._id, {
      owner: normalizedOwner,
      repo: normalizedRepo,
      ...(stages === undefined ? {} : { stages: [...stages] }),
      presenceSeenAt,
    });
  }
  return true;
}

async function finalizeRepoBatch(
  ctx: MutationCtx,
  repoKey: string,
  snapshotAt: number,
  now: number
) {
  const rows = await ctx.db
    .query("reviewPull")
    .withIndex("by_repo_and_state_and_presence", (q) =>
      q
        .eq("repoKey", repoKey)
        .eq("state", "open")
        .lt("presenceSeenAt", snapshotAt)
    )
    .take(100);
  for (const row of rows) {
    await ctx.db.patch(
      "reviewPull",
      row._id,
      row.fetchedAt < snapshotAt
        ? { state: "closed", fetchedAt: now }
        : { presenceSeenAt: snapshotAt }
    );
  }
  return rows.length === 100;
}

async function rewriteGaps(
  ctx: MutationCtx,
  repoKey: string,
  installationId: number,
  flow: Parameters<typeof gapDocsFrom>[2]
) {
  const existing = await ctx.db
    .query("stageGap")
    .withIndex("by_repo", (q) => q.eq("repoKey", repoKey))
    .take(20);
  await Promise.all(existing.map((row) => ctx.db.delete("stageGap", row._id)));
  const gaps = gapDocsFrom(installationId, repoKey, flow);
  await Promise.all(gaps.map((gap) => ctx.db.insert("stageGap", gap)));
}

export const writeRepoMetadata = internalMutation({
  args: {
    installationId: v.number(),
    owner: v.string(),
    repo: v.string(),
    stages: v.array(v.string()),
    gaps: v.array(stageGapValidator),
    snapshotAt: v.number(),
    runId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!(await ownsMaterializationRun(ctx, args.installationId, args.runId))) {
      return null;
    }
    const repoKey = repoKeyOf(args.installationId, args.owner, args.repo);
    if (
      !(await ensureRepoRow(
        ctx,
        args.installationId,
        args.owner,
        args.repo,
        repoKey,
        args.stages,
        args.snapshotAt
      ))
    ) {
      return null;
    }
    await rewriteGaps(ctx, repoKey, args.installationId, {
      owner: args.owner,
      repo: args.repo,
      stages: args.stages,
      gaps: args.gaps,
      openPulls: [],
    });
    return null;
  },
});

export const writePullBatch = internalMutation({
  args: {
    installationId: v.number(),
    owner: v.string(),
    repo: v.string(),
    pulls: v.array(queuePullValidator),
    snapshotAt: v.number(),
    fetchedAt: v.number(),
    runId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!(await ownsMaterializationRun(ctx, args.installationId, args.runId))) {
      return null;
    }
    const repoKey = repoKeyOf(args.installationId, args.owner, args.repo);
    for (const pull of args.pulls) {
      await applyPull(
        ctx,
        pullDocFrom(args.installationId, repoKey, args.owner, args.repo, pull),
        args.snapshotAt,
        args.fetchedAt,
        args.snapshotAt
      );
    }
    return null;
  },
});

export const finalizeRepo = internalMutation({
  args: {
    installationId: v.number(),
    repoKey: v.string(),
    snapshotAt: v.number(),
    now: v.number(),
    runId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) =>
    (await ownsMaterializationRun(ctx, args.installationId, args.runId))
      ? await finalizeRepoBatch(ctx, args.repoKey, args.snapshotAt, args.now)
      : false,
});

export const claimUndiscoveredRepos = internalMutation({
  args: {
    installationId: v.number(),
    snapshotAt: v.number(),
    runId: v.string(),
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    if (!(await ownsMaterializationRun(ctx, args.installationId, args.runId))) {
      return [];
    }
    const repos = await ctx.db
      .query("reviewRepo")
      .withIndex("by_installation_and_presence", (q) =>
        q
          .eq("installationId", args.installationId)
          .lt("presenceSeenAt", args.snapshotAt)
      )
      .take(50);
    await Promise.all(
      repos.map((repo) =>
        ctx.db.patch("reviewRepo", repo._id, {
          presenceSeenAt: args.snapshotAt,
          stages: [],
        })
      )
    );
    return repos.map((repo) => repo.key);
  },
});

export const retireRepo = internalMutation({
  args: {
    installationId: v.number(),
    repoKey: v.string(),
    snapshotAt: v.number(),
    now: v.number(),
    runId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    if (!(await ownsMaterializationRun(ctx, args.installationId, args.runId))) {
      return false;
    }
    const repo = await ctx.db
      .query("reviewRepo")
      .withIndex("by_key", (q) => q.eq("key", args.repoKey))
      .unique();
    if (
      !repo ||
      repo.installationId !== args.installationId ||
      repo.presenceSeenAt !== args.snapshotAt
    ) {
      return false;
    }
    const gaps = await ctx.db
      .query("stageGap")
      .withIndex("by_repo", (q) => q.eq("repoKey", args.repoKey))
      .take(20);
    await Promise.all(gaps.map((gap) => ctx.db.delete("stageGap", gap._id)));
    if (await finalizeRepoBatch(ctx, args.repoKey, args.snapshotAt, args.now)) {
      return true;
    }
    const heads = await ctx.db
      .query("pullHead")
      .withIndex("by_installation_and_owner_and_repo_and_number", (q) =>
        q
          .eq("installationId", args.installationId)
          .eq("owner", repo.owner)
          .eq("repo", repo.repo)
      )
      .take(100);
    await Promise.all(heads.map((head) => ctx.db.delete("pullHead", head._id)));
    if (heads.length === 100) {
      return true;
    }
    await ctx.db.delete("reviewRepo", repo._id);
    return false;
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
    if (await isInstallationRetired(ctx, args.installationId)) {
      return false;
    }
    const repoKey = repoKeyOf(args.installationId, args.owner, args.repo);
    await ensureRepoRow(
      ctx,
      args.installationId,
      args.owner,
      args.repo,
      repoKey
    );
    const doc = pullDocFrom(
      args.installationId,
      repoKey,
      args.owner,
      args.repo,
      args.pull
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
    if (await isInstallationRetired(ctx, args.installationId)) {
      return false;
    }
    const owner = args.owner.toLowerCase();
    const repo = args.repo.toLowerCase();
    const existing = await ctx.db
      .query("pullHead")
      .withIndex("by_installation_and_owner_and_repo_and_number", (q) =>
        q
          .eq("installationId", args.installationId)
          .eq("owner", owner)
          .eq("repo", repo)
          .eq("number", args.number)
      )
      .unique();
    if (existing === null) {
      await ctx.db.insert("pullHead", {
        installationId: args.installationId,
        owner,
        repo,
        number: args.number,
        headSha: args.headSha,
      });
      return true;
    }
    if (existing.headSha === args.headSha) {
      return false;
    }
    await ctx.db.patch("pullHead", existing._id, { headSha: args.headSha });
    return true;
  },
});

export const deletePullHead = internalMutation({
  args: {
    installationId: v.number(),
    owner: v.string(),
    repo: v.string(),
    number: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (await isInstallationRetired(ctx, args.installationId)) {
      return null;
    }
    const owner = args.owner.toLowerCase();
    const repo = args.repo.toLowerCase();
    const existing = await ctx.db
      .query("pullHead")
      .withIndex("by_installation_and_owner_and_repo_and_number", (q) =>
        q
          .eq("installationId", args.installationId)
          .eq("owner", owner)
          .eq("repo", repo)
          .eq("number", args.number)
      )
      .unique();
    if (existing) {
      await ctx.db.delete("pullHead", existing._id);
    }
    return null;
  },
});
