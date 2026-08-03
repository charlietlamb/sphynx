import { ConvexError } from "convex/values";

const REAUTH_CODES = new Set(["UNAUTHENTICATED", "UNAUTHORIZED"]);

/**
 * Codes that will never resolve by retrying — the user genuinely lacks GitHub
 * access, the resource is gone, or GitHub is rate limiting. A read hitting one of
 * these should surface an error card immediately, not spin in a skeleton.
 */
const PERMANENT_CODES = new Set([
  "UNAUTHORIZED",
  "FORBIDDEN",
  "RATE_LIMITED",
  "NOT_FOUND",
]);

const PERMANENT_MESSAGE =
  /not found|PullRequestNotFound|not accessible|rate limit|RateLimited/i;

function convexErrorCode(error: unknown): string | null {
  if (!(error instanceof ConvexError)) {
    return null;
  }
  const data = error.data;
  if (typeof data === "object" && data !== null && "code" in data) {
    return String((data as { code: unknown }).code);
  }
  return null;
}

/**
 * Whether a read failure is permanent — a genuine access/not-found/rate-limit
 * error that a retry cannot fix. The bare `"Unauthenticated"` string that
 * `getAuthUser` throws is deliberately NOT permanent: on a fresh page load the
 * action can fire before the Convex socket finishes authenticating, and that
 * race resolves within a moment. Retrying it is what keeps the PR header from
 * sticking in its skeleton — the page already redirects a genuinely signed-out
 * user before any read runs, so a socket-not-ready blip is all this can be.
 */
export function isPermanentReadError(error: unknown): boolean {
  const code = convexErrorCode(error);
  if (code !== null) {
    return PERMANENT_CODES.has(code);
  }
  const message = error instanceof Error ? error.message : String(error);
  return PERMANENT_MESSAGE.test(message);
}

/**
 * Whether an error means the user's GitHub sign-in must be renewed, as opposed
 * to a transient or unrelated failure. Reserved for genuine auth failures so a
 * GitHub outage or a permission error does not send the user to the reconnect
 * screen. Convex preserves a `ConvexError`'s `data` in production (server errors
 * are otherwise redacted), so classification keys on the structured `code`, with
 * the bare `"Unauthenticated"` string that `getAuthUser` throws handled too.
 */
export function isReauthError(error: unknown): boolean {
  if (!(error instanceof ConvexError)) {
    return false;
  }
  const data = error.data;
  if (data === "Unauthenticated") {
    return true;
  }
  if (typeof data === "object" && data !== null && "code" in data) {
    return REAUTH_CODES.has(String((data as { code: unknown }).code));
  }
  return false;
}

/**
 * A readable one-line cause for a failed installations lookup, drawn from a
 * `ConvexError`'s structured `data` when present (production keeps it), else the
 * error message. Shown as the copyable detail on the error card.
 */
export function installErrorDetail(error: unknown): string | undefined {
  if (error instanceof ConvexError) {
    const data = error.data;
    if (typeof data === "string") {
      return data;
    }
    if (typeof data === "object" && data !== null && "message" in data) {
      return String((data as { message: unknown }).message);
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return;
}
