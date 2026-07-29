"use node";

import { v } from "convex/values";
import { Effect, Schema } from "effect";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { signAppJwt } from "./appJwt";
import { configFromEnv, decodeBody, makeGitHubClient } from "./githubClient";

const TokenSchema = Schema.Struct({
  token: Schema.String,
  expires_at: Schema.String,
});

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
  now: number
): Promise<{ token: string; expiresAt: number }> {
  const { clientId, privateKey } = appCredentials();
  const jwt = signAppJwt(clientId, privateKey, Math.floor(now / 1000));
  const client = makeGitHubClient(configFromEnv());
  const body = await Effect.runPromise(
    client
      .rest(jwt, "POST", `/app/installations/${installationId}/access_tokens`)
      .pipe(
        Effect.flatMap((response) =>
          decodeBody(response, TokenSchema, "Invalid installation token")
        )
      )
  );
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
    if (
      await ctx.runQuery(internal.github.reconcile.isRetired, {
        installationId: args.installationId,
      })
    ) {
      throw new Error("GitHub App installation is retired");
    }
    const cached = await ctx.runQuery(internal.github.tokens.readToken, {
      installationId: args.installationId,
      now: args.now,
    });
    if (cached !== null) {
      return cached;
    }
    const minted = await mintInstallationToken(args.installationId, args.now);
    const stored = await ctx.runMutation(internal.github.tokens.storeToken, {
      installationId: args.installationId,
      token: minted.token,
      expiresAt: minted.expiresAt,
    });
    if (!stored) {
      throw new Error("GitHub App installation was retired");
    }
    return minted.token;
  },
});
