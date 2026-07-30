import { ConvexError } from "convex/values";

const REAUTH_CODES = new Set(["UNAUTHENTICATED", "UNAUTHORIZED"]);

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
