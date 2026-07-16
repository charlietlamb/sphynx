import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { Database } from "@sphynx/db/client";
import { member, schema } from "@sphynx/db/schema";
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { asc, eq } from "drizzle-orm";
import { Context, Effect, Layer, Redacted } from "effect";
import { AuthConfig } from "./config";

const makeAuth = Effect.gen(function* () {
  const config = yield* AuthConfig;
  const db = yield* Database;

  const socialProviders: Record<
    string,
    { clientId: string; clientSecret: string; scope?: string[] }
  > = {};
  if (config.github) {
    socialProviders.github = {
      clientId: config.github.clientId,
      clientSecret: Redacted.value(config.github.clientSecret),
      scope: ["read:user", "user:email", "public_repo"],
    };
  }
  const findFirstOrganizationId = async (userId: string) => {
    const rows = await db
      .select({ organizationId: member.organizationId })
      .from(member)
      .where(eq(member.userId, userId))
      .orderBy(asc(member.createdAt))
      .limit(1);
    return rows[0]?.organizationId;
  };

  return betterAuth({
    baseURL: config.url,
    trustedOrigins: [...config.trustedOrigins],
    advanced: {
      cookiePrefix: "sphynx",
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => ({
            data: {
              ...session,
              activeOrganizationId: await findFirstOrganizationId(
                session.userId
              ),
            },
          }),
        },
      },
    },
    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
    }),
    socialProviders,
    plugins: [organization()],
    secret: Redacted.value(config.secret),
  });
});

export type AuthInstance = Effect.Effect.Success<typeof makeAuth>;

export class Auth extends Context.Tag("@sphynx/auth/Auth")<
  Auth,
  AuthInstance
>() {}

export const AuthLive = Layer.effect(Auth, makeAuth);
