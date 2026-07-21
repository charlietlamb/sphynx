const MIN_BYTES = 1024;

const COMPRESSIBLE =
  /^(application\/(json|javascript|xml)|text\/|image\/svg\+xml)/i;

const prefersGzip = (request: Request) =>
  (request.headers.get("accept-encoding") ?? "").toLowerCase().includes("gzip");

/**
 * Gzip a response body when the client accepts it and the payload is worth
 * compressing. Diffs and queue JSON are highly compressible (often 8-10x), so
 * this is the largest egress lever; streamed and already-encoded responses are
 * left untouched.
 *
 * Skips: bodyless responses, SSE / streams (handled by the caller, never routed
 * here), already-encoded responses, and non-text content types. Reads the body
 * with `arrayBuffer`, so it must not be used on an infinite stream.
 */
export async function compressed(
  request: Request,
  response: Response
): Promise<Response> {
  if (
    !(response.body && prefersGzip(request)) ||
    response.headers.has("content-encoding")
  ) {
    return response;
  }
  const type = response.headers.get("content-type") ?? "";
  if (!COMPRESSIBLE.test(type)) {
    return response;
  }

  const body = new Uint8Array(await response.arrayBuffer());
  if (body.byteLength < MIN_BYTES) {
    return new Response(body, response);
  }

  const zipped = Bun.gzipSync(body);
  const headers = new Headers(response.headers);
  headers.set("content-encoding", "gzip");
  headers.set("content-length", String(zipped.byteLength));
  headers.append("vary", "accept-encoding");
  return new Response(zipped, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}
