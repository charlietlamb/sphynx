const ACCESS_BLOCK = /not accessible by integration|Resource not accessible/i;

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

/**
 * Whether a write failed because the GitHub App lacks the needed permission —
 * detected by GitHub's error message, so it works across a Convex action error,
 * a ConvexError, or a plain Error. A permission failure retries identically
 * until access is granted, so callers surface a "review access" prompt.
 */
export const isAccessBlocked = (error: unknown) =>
  ACCESS_BLOCK.test(errorMessage(error));
