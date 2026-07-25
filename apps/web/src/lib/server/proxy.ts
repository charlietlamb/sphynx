import { serverUrl } from "@/lib/server/server-url";

/**
 * Dev-only bridge from the web server to the API server (in production Vercel
 * rewrites `/api/*` straight to the server service, so this never runs).
 *
 * The forwarded request drops `accept-encoding`: the API server would otherwise
 * gzip the body, but undici decodes it here while leaving the stale
 * `content-encoding` header in place, so the browser tries to decode an
 * already-decoded body (`ERR_CONTENT_DECODING_FAILED`). Over localhost the
 * compression buys nothing anyway.
 */
export function proxyToServer({ request }: { request: Request }) {
  const baseUrl = serverUrl();
  if (!baseUrl) {
    return new Response(
      "AUTH_SERVER_URL or BETTER_AUTH_URL is not configured",
      {
        status: 500,
      }
    );
  }

  const incoming = new URL(request.url);
  const target = new URL(incoming.pathname + incoming.search, baseUrl);
  const headers = new Headers(request.headers);
  headers.delete("accept-encoding");

  return fetch(target, {
    body: request.body,
    headers,
    method: request.method,
    redirect: "manual",
    // @ts-expect-error duplex is required by Node/undici for streamed bodies
    duplex: "half",
  });
}
