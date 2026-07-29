"use node";

import { createSign } from "node:crypto";

const JWT_TTL_SECONDS = 540;
const JWT_CLOCK_SKEW_SECONDS = 60;

/** Normalize the `\n`-escaped env form of a PEM back into real newlines. */
function pemFrom(value: string) {
  return value.replace(/\\n/g, "\n").trim();
}

function base64url(value: string) {
  return Buffer.from(value).toString("base64url");
}

/**
 * Sign a short-lived RS256 JWT proving we are the GitHub App. Not cached — a
 * stale-clock risk outweighs the saving, matching the source server.
 */
export function signAppJwt(
  clientId: string,
  privateKey: string,
  nowSeconds: number
) {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iat: nowSeconds - JWT_CLOCK_SKEW_SECONDS,
      exp: nowSeconds + JWT_TTL_SECONDS,
      iss: clientId,
    })
  );
  const body = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(body);
  return `${body}.${signer.sign(pemFrom(privateKey), "base64url")}`;
}
