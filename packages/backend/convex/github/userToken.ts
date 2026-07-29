import { ConvexError } from "convex/values";
import type { ActionCtx } from "../_generated/server";
import { authComponent, createAuth } from "../auth";

/**
 * A live GitHub user access token (ghu_) for the signed-in user, refreshing it
 * via the stored refresh token when expired. Writes run as this token so GitHub
 * attributes merges, reviews, and comments to the human — never the app. Throws
 * if the user is not signed in or has no linked GitHub account.
 */
export async function userToken(ctx: ActionCtx): Promise<string> {
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
