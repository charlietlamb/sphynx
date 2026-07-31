"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { authComponent } from "../auth";
import { refreshUserAccess } from "./refreshAccess";
import { userToken } from "./userToken";

/**
 * The installations the signed-in user can access, refreshed from GitHub and
 * projected into short-lived grants for the materialized read model.
 */
export const listInstallations = action({
  args: {},
  returns: v.object({
    installations: v.array(
      v.object({
        id: v.number(),
        accountLogin: v.string(),
        accountType: v.string(),
        avatarUrl: v.union(v.string(), v.null()),
        repositorySelection: v.string(),
      })
    ),
  }),
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    const token = await userToken(ctx);
    return await refreshUserAccess(ctx, user._id, token);
  },
});
