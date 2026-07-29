import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { authComponent, createAuth } from "../auth";

/**
 * A live GitHub user access token (ghu_) for the signed-in user, refreshing it
 * via the stored refresh token when expired. Writes run as this token so GitHub
 * attributes merges, reviews, and comments to the human — never the app. Throws
 * if the user is not signed in or has no linked GitHub account.
 */
async function tokenForUser(ctx: ActionCtx, userId: string, cost: number) {
  const allowed = await ctx.runMutation(
    internal.github.access.consumeRateLimit,
    {
      key: `${userId}:github`,
      limit: 120,
      windowMs: 60_000,
      now: Date.now(),
      cost,
    }
  );
  if (!allowed) {
    throw new ConvexError({
      code: "RATE_LIMITED",
      message: "Too many GitHub requests; try again shortly",
    });
  }
  const { auth, headers } = await authComponent.getAuth(createAuth, ctx);
  const result = await auth.api.getAccessToken({
    body: { providerId: "github" },
    headers,
  });
  const token = (result as { accessToken?: string }).accessToken;
  if (!token) {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "No GitHub access token for the current user",
    });
  }
  return token;
}

export async function userToken(ctx: ActionCtx, cost = 1): Promise<string> {
  const user = await authComponent.getAuthUser(ctx);
  return await tokenForUser(ctx, user._id, cost);
}

export async function userTokenForRepository(
  ctx: ActionCtx,
  owner: string,
  repo: string,
  cost = 1
): Promise<string> {
  const user = await authComponent.getAuthUser(ctx);
  const installationId = await ctx.runQuery(
    internal.github.access.installationForRepo,
    { userId: user._id, owner, repo }
  );
  if (installationId === null) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "You do not have access to this repository",
    });
  }
  return await tokenForUser(ctx, user._id, cost);
}
