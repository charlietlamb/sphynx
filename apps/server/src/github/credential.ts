import type { Effect } from "effect";
import type { GitHubAuthedError } from "./errors";

/**
 * How a GitHub request is authenticated.
 *
 * - `installation` — the app acting on an org. Has its own rate-limit budget.
 * - `user` — the signed-in human. Used for writes so GitHub attributes them.
 */
type CredentialKind = "installation" | "user";

/**
 * A resolved way to call GitHub.
 *
 * `id` is stable across token rotation and is what caches key on. Installation
 * tokens expire hourly, so the raw token must never be used as a cache key.
 *
 * `token` is an Effect so refresh happens inside the cache lookup rather than at
 * the call site.
 */
export interface GitHubCredential {
  readonly id: string;
  readonly kind: CredentialKind;
  readonly token: Effect.Effect<string, GitHubAuthedError>;
}

export const installationCredentialId = (installationId: number) =>
  `inst:${installationId}`;

export const userCredentialId = (userId: string) => `user:${userId}`;
