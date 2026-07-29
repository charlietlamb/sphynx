"use node";

import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_PREFIX = "sha256=";

function webhookSecrets(): string[] {
  return [
    process.env.GITHUB_WEBHOOK_SECRET,
    process.env.GITHUB_WEBHOOK_SECRET_PREVIOUS,
  ].filter((secret): secret is string => Boolean(secret && secret.length > 0));
}

/**
 * Verify a GitHub webhook HMAC-SHA256 signature against the raw body, in
 * constant time, accepting either the current or a previous secret so the secret
 * can rotate with zero downtime.
 */
export function verifySignature(body: string, signature: string | null): boolean {
  const secrets = webhookSecrets();
  if (secrets.length === 0 || !signature?.startsWith(SIGNATURE_PREFIX)) {
    return false;
  }
  const provided = Uint8Array.from(
    Buffer.from(signature.slice(SIGNATURE_PREFIX.length), "hex"),
  );
  if (provided.length === 0) {
    return false;
  }
  return secrets.some((secret) => {
    const expected = Uint8Array.from(
      createHmac("sha256", secret).update(body).digest(),
    );
    return (
      expected.length === provided.length && timingSafeEqual(expected, provided)
    );
  });
}
