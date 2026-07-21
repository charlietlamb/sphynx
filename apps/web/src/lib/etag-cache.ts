import { Schema } from "effect";

interface Cached {
  readonly etag: string;
  readonly value: unknown;
}

/**
 * A per-URL ETag store so conditional requests can short-circuit on the server's
 * 304. The server already emits an ETag and honours `if-none-match` on the pull
 * summary, but a plain `fetch` never sends the validator, so every load was a
 * full 200. Sending the stored ETag turns an unchanged summary into a tiny 304.
 *
 * The value is kept alongside the ETag because a 304 carries no body — the
 * caller needs the last decoded payload to return. TanStack Query still owns the
 * real cache lifetime; this only accelerates its refetches.
 */
const store = new Map<string, Cached>();

export async function fetchWithEtag<A, I>(
  url: string,
  schema: Schema.Schema<A, I>,
  onError: (response: Response) => Promise<never>
): Promise<A> {
  const previous = store.get(url);
  const response = await fetch(url, {
    headers: previous ? { "if-none-match": previous.etag } : {},
  });

  if (response.status === 304 && previous) {
    return Schema.decodeUnknownPromise(schema)(previous.value);
  }

  if (!response.ok) {
    return onError(response);
  }

  const body = await response.json();
  const etag = response.headers.get("etag");
  if (etag) {
    store.set(url, { etag, value: body });
  }
  return Schema.decodeUnknownPromise(schema)(body);
}
