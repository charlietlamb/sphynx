"use node";

import { createSign } from "node:crypto";
import { v } from "convex/values";
import { internalAction } from "../_generated/server";

const JWT_TTL_SECONDS = 540;
const JWT_CLOCK_SKEW_SECONDS = 60;

function pemFrom(value: string) {
  return value.replace(/\\n/g, "\n").trim();
}

function base64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function appJwt(clientId: string, privateKey: string, nowSeconds: number) {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iat: nowSeconds - JWT_CLOCK_SKEW_SECONDS,
      exp: nowSeconds + JWT_TTL_SECONDS,
      iss: clientId,
    }),
  );
  const signingInput = `${header}.${payload}`;
  const signature = createSign("RSA-SHA256")
    .update(signingInput)
    .sign(pemFrom(privateKey));
  return `${signingInput}.${base64url(signature)}`;
}

export const probeAppAuth = internalAction({
  args: { nowSeconds: v.number() },
  returns: v.object({
    jwtSigned: v.boolean(),
    appName: v.union(v.string(), v.null()),
    installationCount: v.union(v.number(), v.null()),
    expiringUserTokens: v.union(v.boolean(), v.null()),
    error: v.union(v.string(), v.null()),
  }),
  handler: async (_ctx, args) => {
    const clientId = process.env.GITHUB_APP_CLIENT_ID;
    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
    if (!(clientId && privateKey)) {
      return {
        jwtSigned: false,
        appName: null,
        installationCount: null,
        expiringUserTokens: null,
        error: "missing GITHUB_APP_CLIENT_ID or GITHUB_APP_PRIVATE_KEY",
      };
    }
    let jwt: string;
    try {
      jwt = appJwt(clientId, privateKey, args.nowSeconds);
    } catch (cause) {
      return {
        jwtSigned: false,
        appName: null,
        installationCount: null,
        expiringUserTokens: null,
        error: `jwt signing failed: ${String(cause)}`,
      };
    }
    const res = await fetch("https://api.github.com/app", {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!res.ok) {
      return {
        jwtSigned: true,
        appName: null,
        installationCount: null,
        expiringUserTokens: null,
        error: `GET /app -> ${res.status} ${await res.text()}`,
      };
    }
    const app = (await res.json()) as {
      name?: string;
      installations_count?: number;
    };
    return {
      jwtSigned: true,
      appName: app.name ?? null,
      installationCount: app.installations_count ?? null,
      expiringUserTokens: null,
      error: null,
    };
  },
});
