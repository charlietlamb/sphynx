import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { isInstallationRetired } from "./installationState";

/** Refresh installation tokens early: GitHub gives 60 min, we treat 50 as live. */
const TOKEN_SKEW_MS = 10 * 60 * 1000;

export const readToken = internalQuery({
  args: { installationId: v.number(), now: v.number() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("installationToken")
      .withIndex("by_installationId", (q) =>
        q.eq("installationId", args.installationId)
      )
      .unique();
    if (row === null || row.expiresAt - TOKEN_SKEW_MS <= args.now) {
      return null;
    }
    return row.token;
  },
});

export const storeToken = internalMutation({
  args: {
    installationId: v.number(),
    token: v.string(),
    expiresAt: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    if (await isInstallationRetired(ctx, args.installationId)) {
      return false;
    }
    const row = await ctx.db
      .query("installationToken")
      .withIndex("by_installationId", (q) =>
        q.eq("installationId", args.installationId)
      )
      .unique();
    if (row === null) {
      await ctx.db.insert("installationToken", {
        installationId: args.installationId,
        token: args.token,
        expiresAt: args.expiresAt,
      });
      return true;
    }
    await ctx.db.patch("installationToken", row._id, {
      token: args.token,
      expiresAt: args.expiresAt,
    });
    return true;
  },
});
