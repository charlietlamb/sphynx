import { serverUrl } from "@/lib/server/server-url";

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

  return fetch(target, {
    body: request.body,
    headers: request.headers,
    method: request.method,
    redirect: "manual",
    // @ts-expect-error duplex is required by Node/undici for streamed bodies
    duplex: "half",
  });
}
