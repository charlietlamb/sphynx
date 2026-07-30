import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { QueryCtx } from "../_generated/server";
import { internalMutation, internalQuery } from "../_generated/server";
import { MAX_USER_INSTALLATIONS, REPO_GRANT_DELETE_BATCH } from "./limits";
import { repoKeyOf } from "./rows";

export const ACCESS_TTL_MS = 30 * 60_000;

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

export async function repositoryKeysForInstallation(
  ctx: QueryCtx,
  installationId: number
) {
  const access = await requireInstallation(ctx, installationId);
  const rows = await ctx.db
    .query("userRepository")
    .withIndex("by_user_and_installation_and_verifiedAt", (q) =>
      q
        .eq("userId", access.userId)
        .eq("installationId", installationId)
        .eq("verifiedAt", access.verifiedAt)
    )
    .collect();
  return new Set(rows.map((row) => row.repoKey));
}

export async function requireRepository(
  ctx: QueryCtx,
  installationId: number,
  owner: string,
  repo: string
) {
  const access = await requireInstallation(ctx, installationId);
  const grant = await ctx.db
    .query("userRepository")
    .withIndex("by_user_and_installation_and_repo", (q) =>
      q
        .eq("userId", access.userId)
        .eq("installationId", installationId)
        .eq("repoKey", repoKeyOf(installationId, owner, repo))
    )
    .unique();
  if (!grant || grant.verifiedAt !== access.verifiedAt) {
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
  const installations = await ctx.db
    .query("userInstallation")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(MAX_USER_INSTALLATIONS + 1);
  if (installations.length > MAX_USER_INSTALLATIONS) {
    throw new Error(
      `More than ${MAX_USER_INSTALLATIONS} GitHub App installations are not supported`
    );
  }
  const now = Date.now();
  for (const access of installations) {
    if (access.verifiedAt < now - ACCESS_TTL_MS) {
      continue;
    }
    const grant = await ctx.db
      .query("userRepository")
      .withIndex("by_user_and_installation_and_repo", (q) =>
        q
          .eq("userId", userId)
          .eq("installationId", access.installationId)
          .eq("repoKey", repoKeyOf(access.installationId, owner, repo))
      )
      .unique();
    if (grant?.verifiedAt === access.verifiedAt) {
      return access.installationId;
    }
  }
  return null;
}

export const syncInstallations = internalMutation({
  args: {
    userId: v.string(),
    installations: v.array(
      v.object({ installationId: v.number(), accountLogin: v.string() })
    ),
    verifiedAt: v.number(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userInstallation")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .take(MAX_USER_INSTALLATIONS + 1);
    if (existing.length > MAX_USER_INSTALLATIONS) {
      throw new Error(
        `More than ${MAX_USER_INSTALLATIONS} GitHub App installations are not supported`
      );
    }
    const verifiedAt = Math.max(
      args.verifiedAt,
      ...existing.map((row) => row.verifiedAt + 1)
    );
    await Promise.all(
      existing.map((row) =>
        ctx.scheduler.runAfter(
          0,
          internal.github.access.deleteRepositoryGrants,
          {
            userId: row.userId,
            installationId: row.installationId,
            verifiedAt: row.verifiedAt,
          }
        )
      )
    );
    await Promise.all(
      existing.map((row) => ctx.db.delete("userInstallation", row._id))
    );
    await Promise.all(
      args.installations.map((installation) =>
        ctx.db.insert("userInstallation", {
          userId: args.userId,
          ...installation,
          verifiedAt,
        })
      )
    );
    await ctx.scheduler.runAt(
      verifiedAt + ACCESS_TTL_MS,
      internal.github.access.expireInstallations,
      { userId: args.userId, verifiedAt }
    );
    return verifiedAt;
  },
});

export const expireInstallations = internalMutation({
  args: { userId: v.string(), verifiedAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("userInstallation")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .take(200);
    const expired = rows.filter((row) => row.verifiedAt === args.verifiedAt);
    await Promise.all(
      expired.flatMap((row) => [
        ctx.db.delete("userInstallation", row._id),
        ctx.scheduler.runAfter(
          0,
          internal.github.access.deleteRepositoryGrants,
          {
            userId: row.userId,
            installationId: row.installationId,
            verifiedAt: row.verifiedAt,
          }
        ),
      ])
    );
    return null;
  },
});

export const deleteRepositoryGrants = internalMutation({
  args: {
    userId: v.string(),
    installationId: v.number(),
    verifiedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("userRepository")
      .withIndex("by_user_and_installation_and_verifiedAt", (q) =>
        q
          .eq("userId", args.userId)
          .eq("installationId", args.installationId)
          .eq("verifiedAt", args.verifiedAt)
      )
      .take(REPO_GRANT_DELETE_BATCH);
    await Promise.all(
      rows.map((row) => ctx.db.delete("userRepository", row._id))
    );
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

export const syncRepositories = internalMutation({
  args: {
    userId: v.string(),
    installationId: v.number(),
    repoKeys: v.array(v.string()),
    verifiedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const access = await ctx.db
      .query("userInstallation")
      .withIndex("by_user_and_installation", (q) =>
        q.eq("userId", args.userId).eq("installationId", args.installationId)
      )
      .unique();
    if (access?.verifiedAt !== args.verifiedAt) {
      return null;
    }
    const existing = await ctx.db
      .query("userRepository")
      .withIndex("by_user_and_installation_and_verifiedAt", (q) =>
        q.eq("userId", args.userId).eq("installationId", args.installationId)
      )
      .collect();
    await Promise.all(
      existing.map((row) => ctx.db.delete("userRepository", row._id))
    );
    await Promise.all(
      args.repoKeys.map((repoKey) =>
        ctx.db.insert("userRepository", {
          userId: args.userId,
          installationId: args.installationId,
          repoKey,
          verifiedAt: args.verifiedAt,
        })
      )
    );
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

export const repositoryKeysForUserInstallation = internalQuery({
  args: { userId: v.string(), installationId: v.number() },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const access = await ctx.db
      .query("userInstallation")
      .withIndex("by_user_and_installation", (q) =>
        q.eq("userId", args.userId).eq("installationId", args.installationId)
      )
      .unique();
    if (!access || access.verifiedAt < Date.now() - ACCESS_TTL_MS) {
      return [];
    }
    const rows = await ctx.db
      .query("userRepository")
      .withIndex("by_user_and_installation_and_verifiedAt", (q) =>
        q
          .eq("userId", args.userId)
          .eq("installationId", args.installationId)
          .eq("verifiedAt", access.verifiedAt)
      )
      .collect();
    return rows.map((row) => row.repoKey);
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
