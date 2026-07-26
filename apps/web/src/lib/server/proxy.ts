import { serverUrl } from "@/lib/server/server-url";

/**
 * Dev-only bridge from the web server to the API server (in production Vercel
 * rewrites `/api/*` straight to the server service, so this never runs).
 *
 * The forwarded request asks for `identity`: Bun's fetch re-adds a gzip
 * `accept-encoding` if the header is merely deleted, so the API server would
 * compress the body, Bun would decode it here, and the stale `content-encoding`
 * header would make the browser decode an already-decoded body
 * (`ERR_CONTENT_DECODING_FAILED`). `identity` is honored, so the server sends
 * plain bytes — and over localhost the compression buys nothing anyway.
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
  const forwarded = new Headers(request.headers);
  forwarded.set("accept-encoding", "identity");

  return fetch(target, {
    body: request.body,
    headers: forwarded,
    method: request.method,
    redirect: "manual",
    // @ts-expect-error duplex is required by Node/undici for streamed bodies
    duplex: "half",
  });
}
