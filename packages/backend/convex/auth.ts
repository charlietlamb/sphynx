import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { type BetterAuthOptions, betterAuth } from "better-auth/minimal";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";
import authSchema from "./betterAuth/schema";

const siteUrl = process.env.SITE_URL ?? "http://localhost:3006";

/** Every origin the client may call auth from — comma-separated in env. */
const trustedOrigins = (process.env.AUTH_TRUSTED_ORIGINS ?? siteUrl)
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

/**
 * The public origin Better Auth builds OAuth redirects against. In production
 * this is the deployment's own CONVEX_SITE_URL; in tunneled local dev, set
 * AUTH_PUBLIC_URL to the ngrok URL so the GitHub callback matches.
 */
const authBaseUrl = process.env.AUTH_PUBLIC_URL ?? process.env.CONVEX_SITE_URL;

export const authComponent = createClient<DataModel, typeof authSchema>(
  components.betterAuth,
  { local: { schema: authSchema } }
);

function githubProvider() {
  const clientId = process.env.GITHUB_APP_CLIENT_ID;
  const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET;
  if (!(clientId && clientSecret)) {
    return {};
  }
  return { github: { clientId, clientSecret } };
}

export const createAuthOptions = (ctx: GenericCtx<DataModel>) =>
  ({
    baseURL: authBaseUrl,
    trustedOrigins,
    database: authComponent.adapter(ctx),
    session: {
      /**
       * Cache the validated session in a signed cookie so the hot read path
       * resolves from the cookie instead of a round-trip. Short TTL keeps
       * revocation responsive.
       */
      cookieCache: { enabled: true, maxAge: 300 },
    },
    socialProviders: githubProvider(),
    plugins: [crossDomain({ siteUrl }), convex({ authConfig })],
  }) satisfies BetterAuthOptions;

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth(createAuthOptions(ctx));
