import { Schema } from "effect";

interface ApiErrorBody {
  readonly _tag?: string;
  readonly message?: string;
}

/**
 * A failed write, carrying GitHub's own message.
 *
 * `postJson` used to throw a bare Error with only the status, so callers could
 * not tell a permissions problem from a transient failure and every mutation
 * showed the same generic toast.
 */
class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message ?? `Request failed (${status})`);
    this.status = status;
    this.body = body;
  }
}

/**
 * GitHub refuses a write the app has no permission for with this phrasing.
 * It cannot be fixed by signing in again: repository permissions must be
 * approved on the installation.
 */
const ACCESS_BLOCK = /not accessible by integration|Resource not accessible/i;

export const isAccessBlocked = (error: unknown) =>
  error instanceof ApiError &&
  Boolean(error.body.message) &&
  ACCESS_BLOCK.test(String(error.body.message));

export async function postJson(url: string, body?: object): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const parsed: ApiErrorBody = await response
      .json()
      .catch(() => ({}) as ApiErrorBody);
    throw new ApiError(response.status, parsed);
  }
  return response.json();
}

export async function postDecoded<A, I>(
  url: string,
  schema: Schema.Schema<A, I>,
  body?: object
): Promise<A> {
  return await Schema.decodeUnknownPromise(schema)(await postJson(url, body));
}
