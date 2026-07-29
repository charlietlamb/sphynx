"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { signAppJwt } from "./appJwt";

const API_URL = process.env.GITHUB_API_URL ?? "https://api.github.com";
const API_VERSION = process.env.GITHUB_API_VERSION ?? "2022-11-28";

function appCredentials() {
  const clientId = process.env.GITHUB_APP_CLIENT_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!(clientId && privateKey)) {
    throw new Error("GITHUB_APP_CLIENT_ID or GITHUB_APP_PRIVATE_KEY not set");
  }
  return { clientId, privateKey };
}

async function mintInstallationToken(
  installationId: number,
  now: number,
): Promise<{ token: string; expiresAt: number }> {
  const { clientId, privateKey } = appCredentials();
  const jwt = signAppJwt(clientId, privateKey, Math.floor(now / 1000));
  const res = await fetch(
    `${API_URL}/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": API_VERSION,
      },
    },
  );
  if (!res.ok) {
    throw new Error(
      `mint installation token failed: ${res.status} ${await res.text()}`,
    );
  }
  const body = (await res.json()) as { token: string; expires_at: string };
  return { token: body.token, expiresAt: new Date(body.expires_at).getTime() };
}

/**
 * Get a live installation token, minting + caching one when the cached token is
 * absent or near expiry. The Convex `installationToken` table replaces the
 * source server's in-process Effect Cache.
 */
export const installationToken = internalAction({
  args: { installationId: v.number(), now: v.number() },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const cached = await ctx.runQuery(internal.github.tokens.readToken, {
      installationId: args.installationId,
      now: args.now,
    });
    if (cached !== null) {
      return cached;
    }
    const minted = await mintInstallationToken(args.installationId, args.now);
    await ctx.runMutation(internal.github.tokens.storeToken, {
      installationId: args.installationId,
      token: minted.token,
      expiresAt: minted.expiresAt,
    });
    return minted.token;
  },
});
