import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { QueryCtx } from "../_generated/server";
import { internalMutation, internalQuery } from "../_generated/server";
import { installationValidator } from "./accessContract";
import { MAX_USER_INSTALLATIONS, REPO_GRANT_DELETE_BATCH } from "./limits";
import { repoKeyOf } from "./rows";

export const ACCESS_TTL_MS = 30 * 60_000;
export const ACCESS_REFRESH_LEASE_MS = 4 * 60_000;
const MAX_ACCESS_CHECKS = 500;
const REPOSITORY_STAGE_BATCH = 100;

async function userInstallations(ctx: QueryCtx, userId: string) {
  const rows = await ctx.db
    .query("userInstallation")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(MAX_USER_INSTALLATIONS + 1);
  if (rows.length > MAX_USER_INSTALLATIONS) {
    throw new Error(
      `More than ${MAX_USER_INSTALLATIONS} GitHub App installations are not supported`
    );
  }
  return rows;
}

export async function requireUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
  }
  return { _id: identity.subject };
}

export async function requireInstallation(
  ctx: QueryCtx,
  installationId: number
) {
  const user = await requireUser(ctx);
  const access = await ctx.db
    .query("userInstallation")
    .withIndex("by_user_and_installation", (q) =>
      q.eq("userId", user._id).eq("installationId", installationId)
    )
    .unique();
  if (!access || access.verifiedAt < Date.now() - ACCESS_TTL_MS) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "You do not have access to this installation",
    });
  }
  return access;
}

async function grantFor(
  ctx: QueryCtx,
  userId: string,
  installationId: number,
  repoKey: string,
  verifiedAt: number
) {
  return await ctx.db
    .query("userRepository")
    .withIndex("by_user_and_installation_and_repo_and_verifiedAt", (q) =>
      q
        .eq("userId", userId)
        .eq("installationId", installationId)
        .eq("repoKey", repoKey)
        .eq("verifiedAt", verifiedAt)
    )
    .unique();
}

export async function repositoryKeysForInstallation(
  ctx: QueryCtx,
  installationId: number,
  repoKeys: readonly string[]
) {
  const access = await requireInstallation(ctx, installationId);
  const keys = [...new Set(repoKeys)];
  if (keys.length > MAX_ACCESS_CHECKS) {
    throw new Error(`More than ${MAX_ACCESS_CHECKS} access checks requested`);
  }
  const grants = await Promise.all(
    keys.map((key) =>
      grantFor(ctx, access.userId, installationId, key, access.verifiedAt)
    )
  );
  return new Set(keys.filter((_, index) => grants[index] !== null));
}

export async function requireRepository(
  ctx: QueryCtx,
  installationId: number,
  owner: string,
  repo: string
) {
  const access = await requireInstallation(ctx, installationId);
  const grant = await grantFor(
    ctx,
    access.userId,
    installationId,
    repoKeyOf(installationId, owner, repo),
    access.verifiedAt
  );
  if (!grant) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "You do not have access to this repository",
    });
  }
  return grant;
}

export async function grantedInstallationForRepo(
  ctx: QueryCtx,
  userId: string,
  owner: string,
  repo: string
) {
  const installations = await userInstallations(ctx, userId);
  const now = Date.now();
  for (const access of installations) {
    if (access.verifiedAt < now - ACCESS_TTL_MS) {
      continue;
    }
    const grant = await grantFor(
      ctx,
      userId,
      access.installationId,
      repoKeyOf(access.installationId, owner, repo),
      access.verifiedAt
    );
    if (grant) {
      return access.installationId;
    }
  }
  return null;
}

export const beginAccessRefresh = internalMutation({
  args: { userId: v.string(), runId: v.string(), now: v.number() },
  returns: v.object({ acquired: v.boolean(), verifiedAt: v.number() }),
  handler: async (ctx, args) => {
    const refresh = await ctx.db
      .query("userAccessRefresh")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (refresh?.status === "refreshing" && refresh.leaseExpiresAt > args.now) {
      return { acquired: false, verifiedAt: refresh.verifiedAt };
    }
    const installations = await userInstallations(ctx, args.userId);
    const verifiedAt = Math.max(
      args.now,
      refresh?.verifiedAt ? refresh.verifiedAt + 1 : 0,
      ...installations.map((row) => row.verifiedAt + 1)
    );
    if (refresh) {
      await ctx.db.patch("userAccessRefresh", refresh._id, {
        runId: args.runId,
        status: "refreshing",
        verifiedAt,
        leaseExpiresAt: args.now + ACCESS_REFRESH_LEASE_MS,
      });
      if (refresh.status !== "completed") {
        await ctx.scheduler.runAfter(
          0,
          internal.github.access.deleteRepositoryGrants,
          { userId: args.userId, verifiedAt: refresh.verifiedAt }
        );
      }
    } else {
      await ctx.db.insert("userAccessRefresh", {
        userId: args.userId,
        runId: args.runId,
        status: "refreshing",
        verifiedAt,
        leaseExpiresAt: args.now + ACCESS_REFRESH_LEASE_MS,
      });
    }
    await ctx.scheduler.runAt(
      args.now + ACCESS_REFRESH_LEASE_MS,
      internal.github.access.expireAccessRefresh,
      { userId: args.userId, runId: args.runId }
    );
    return { acquired: true, verifiedAt };
  },
});

export const stageRepositories = internalMutation({
  args: {
    userId: v.string(),
    runId: v.string(),
    installationId: v.number(),
    repoKeys: v.array(v.string()),
    now: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    if (args.repoKeys.length > REPOSITORY_STAGE_BATCH) {
      throw new Error(
        `Repository grant batches cannot exceed ${REPOSITORY_STAGE_BATCH}`
      );
    }
    const refresh = await ctx.db
      .query("userAccessRefresh")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (
      !refresh ||
      refresh.runId !== args.runId ||
      refresh.status !== "refreshing" ||
      refresh.leaseExpiresAt <= args.now
    ) {
      return false;
    }
    for (const repoKey of new Set(args.repoKeys)) {
      const existing = await grantFor(
        ctx,
        args.userId,
        args.installationId,
        repoKey,
        refresh.verifiedAt
      );
      if (!existing) {
        await ctx.db.insert("userRepository", {
          userId: args.userId,
          installationId: args.installationId,
          repoKey,
          verifiedAt: refresh.verifiedAt,
        });
      }
    }
    await ctx.db.patch("userAccessRefresh", refresh._id, {
      leaseExpiresAt: args.now + ACCESS_REFRESH_LEASE_MS,
    });
    return true;
  },
});

export const activateAccessRefresh = internalMutation({
  args: {
    userId: v.string(),
    runId: v.string(),
    installations: v.array(installationValidator),
    now: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    if (args.installations.length > MAX_USER_INSTALLATIONS) {
      throw new Error(
        `More than ${MAX_USER_INSTALLATIONS} GitHub App installations are not supported`
      );
    }
    const refresh = await ctx.db
      .query("userAccessRefresh")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (
      !refresh ||
      refresh.runId !== args.runId ||
      refresh.status !== "refreshing" ||
      refresh.leaseExpiresAt <= args.now
    ) {
      return false;
    }
    const existing = await userInstallations(ctx, args.userId);
    for (const row of existing) {
      await ctx.db.delete("userInstallation", row._id);
    }
    for (const installation of args.installations) {
      await ctx.db.insert("userInstallation", {
        userId: args.userId,
        installationId: installation.id,
        accountLogin: installation.accountLogin,
        accountType: installation.accountType,
        avatarUrl: installation.avatarUrl,
        repositorySelection: installation.repositorySelection,
        verifiedAt: refresh.verifiedAt,
      });
    }
    await ctx.db.patch("userAccessRefresh", refresh._id, {
      status: "completed",
      leaseExpiresAt: 0,
    });
    for (const verifiedAt of new Set(existing.map((row) => row.verifiedAt))) {
      await ctx.scheduler.runAfter(
        0,
        internal.github.access.deleteRepositoryGrants,
        { userId: args.userId, verifiedAt }
      );
    }
    await ctx.scheduler.runAt(
      refresh.verifiedAt + ACCESS_TTL_MS,
      internal.github.access.expireInstallations,
      { userId: args.userId, verifiedAt: refresh.verifiedAt }
    );
    return true;
  },
});

export const abortAccessRefresh = internalMutation({
  args: { userId: v.string(), runId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const refresh = await ctx.db
      .query("userAccessRefresh")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (refresh?.runId === args.runId && refresh.status === "refreshing") {
      await ctx.db.patch("userAccessRefresh", refresh._id, {
        status: "aborted",
        leaseExpiresAt: 0,
      });
      await ctx.scheduler.runAfter(
        0,
        internal.github.access.deleteRepositoryGrants,
        { userId: args.userId, verifiedAt: refresh.verifiedAt }
      );
    }
    return null;
  },
});

export const expireAccessRefresh = internalMutation({
  args: { userId: v.string(), runId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const refresh = await ctx.db
      .query("userAccessRefresh")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (
      !refresh ||
      refresh.runId !== args.runId ||
      refresh.status !== "refreshing"
    ) {
      return null;
    }
    if (refresh.leaseExpiresAt > Date.now()) {
      await ctx.scheduler.runAt(
        refresh.leaseExpiresAt,
        internal.github.access.expireAccessRefresh,
        args
      );
      return null;
    }
    await ctx.db.patch("userAccessRefresh", refresh._id, {
      status: "aborted",
      leaseExpiresAt: 0,
    });
    await ctx.scheduler.runAfter(
      0,
      internal.github.access.deleteRepositoryGrants,
      { userId: args.userId, verifiedAt: refresh.verifiedAt }
    );
    return null;
  },
});

export const accessRefreshInProgress = internalQuery({
  args: { userId: v.string(), now: v.number() },
  returns: v.union(
    v.literal("refreshing"),
    v.literal("completed"),
    v.literal("aborted"),
    v.null()
  ),
  handler: async (ctx, args) => {
    const refresh = await ctx.db
      .query("userAccessRefresh")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (!refresh) {
      return null;
    }
    if (refresh.status === "refreshing" && refresh.leaseExpiresAt > args.now) {
      return "refreshing";
    }
    return refresh.status === "completed" ? "completed" : "aborted";
  },
});

export const renewAccessRefresh = internalMutation({
  args: { userId: v.string(), runId: v.string(), now: v.number() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const refresh = await ctx.db
      .query("userAccessRefresh")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (
      refresh?.runId !== args.runId ||
      refresh.status !== "refreshing" ||
      refresh.leaseExpiresAt <= args.now
    ) {
      return false;
    }
    await ctx.db.patch("userAccessRefresh", refresh._id, {
      leaseExpiresAt: args.now + ACCESS_REFRESH_LEASE_MS,
    });
    return true;
  },
});

export const activeInstallations = internalQuery({
  args: { userId: v.string() },
  returns: v.array(installationValidator),
  handler: async (ctx, args) => {
    const now = Date.now();
    const rows = await userInstallations(ctx, args.userId);
    return rows
      .filter((row) => row.verifiedAt >= now - ACCESS_TTL_MS)
      .map((row) => ({
        id: row.installationId,
        accountLogin: row.accountLogin,
        accountType: row.accountType ?? "",
        avatarUrl: row.avatarUrl ?? null,
        repositorySelection: row.repositorySelection ?? "",
      }));
  },
});

export const expireInstallations = internalMutation({
  args: { userId: v.string(), verifiedAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const rows = await userInstallations(ctx, args.userId);
    const expired = rows.filter((row) => row.verifiedAt === args.verifiedAt);
    for (const row of expired) {
      await ctx.db.delete("userInstallation", row._id);
    }
    if (expired.length > 0) {
      await ctx.scheduler.runAfter(
        0,
        internal.github.access.deleteRepositoryGrants,
        args
      );
    }
    return null;
  },
});

export const deleteRepositoryGrants = internalMutation({
  args: { userId: v.string(), verifiedAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("userRepository")
      .withIndex("by_user_and_verifiedAt", (q) =>
        q.eq("userId", args.userId).eq("verifiedAt", args.verifiedAt)
      )
      .take(REPO_GRANT_DELETE_BATCH);
    for (const row of rows) {
      await ctx.db.delete("userRepository", row._id);
    }
    if (rows.length === REPO_GRANT_DELETE_BATCH) {
      await ctx.scheduler.runAfter(
        0,
        internal.github.access.deleteRepositoryGrants,
        args
      );
    }
    return null;
  },
});

export const canAccessInstallation = internalQuery({
  args: { userId: v.string(), installationId: v.number() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const access = await ctx.db
      .query("userInstallation")
      .withIndex("by_user_and_installation", (q) =>
        q.eq("userId", args.userId).eq("installationId", args.installationId)
      )
      .unique();
    if (!access || access.verifiedAt < Date.now() - ACCESS_TTL_MS) {
      return false;
    }
    const grant = await ctx.db
      .query("userRepository")
      .withIndex("by_user_and_installation_and_verifiedAt", (q) =>
        q
          .eq("userId", args.userId)
          .eq("installationId", args.installationId)
          .eq("verifiedAt", access.verifiedAt)
      )
      .first();
    return grant !== null;
  },
});

export const installationForRepo = internalQuery({
  args: { userId: v.string(), owner: v.string(), repo: v.string() },
  returns: v.union(v.number(), v.null()),
  handler: (ctx, args) =>
    grantedInstallationForRepo(ctx, args.userId, args.owner, args.repo),
});

export const filterRepositoryKeys = internalQuery({
  args: {
    userId: v.string(),
    installationId: v.number(),
    repoKeys: v.array(v.string()),
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const access = await ctx.db
      .query("userInstallation")
      .withIndex("by_user_and_installation", (q) =>
        q.eq("userId", args.userId).eq("installationId", args.installationId)
      )
      .unique();
    const keys = [...new Set(args.repoKeys)];
    if (
      !access ||
      access.verifiedAt < Date.now() - ACCESS_TTL_MS ||
      keys.length > MAX_ACCESS_CHECKS
    ) {
      return [];
    }
    const grants = await Promise.all(
      keys.map((key) =>
        grantFor(ctx, args.userId, args.installationId, key, access.verifiedAt)
      )
    );
    return keys.filter((_, index) => grants[index] !== null);
  },
});

export const consumeRateLimit = internalMutation({
  args: {
    key: v.string(),
    limit: v.number(),
    windowMs: v.number(),
    now: v.number(),
    cost: v.optional(v.number()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const cost = Math.max(1, Math.floor(args.cost ?? 1));
    const existing = await ctx.db
      .query("rateLimit")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (!existing || existing.windowStartedAt + args.windowMs <= args.now) {
      if (existing) {
        await ctx.db.patch("rateLimit", existing._id, {
          count: cost,
          windowStartedAt: args.now,
        });
      } else {
        await ctx.db.insert("rateLimit", {
          key: args.key,
          count: cost,
          windowStartedAt: args.now,
        });
      }
      return true;
    }
    if (existing.count + cost > args.limit) {
      return false;
    }
    await ctx.db.patch("rateLimit", existing._id, {
      count: existing.count + cost,
    });
    return true;
  },
});
