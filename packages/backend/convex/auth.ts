import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import { organization } from "better-auth/plugins";
import authConfig from "./auth.config";
import authSchema from "./betterAuth/schema";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";

const siteUrl = process.env.SITE_URL ?? "http://localhost:3006";

export const authComponent = createClient<DataModel, typeof authSchema>(
  components.betterAuth,
  { local: { schema: authSchema } },
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
    baseURL: process.env.CONVEX_SITE_URL,
    trustedOrigins: [siteUrl],
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
    plugins: [organization(), convex({ authConfig })],
  }) satisfies BetterAuthOptions;

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth(createAuthOptions(ctx));

export const { getAuthUser } = authComponent.clientApi();
