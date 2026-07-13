import { createFileRoute } from "@tanstack/react-router";
import { proxyToServer } from "@/lib/server/proxy";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: proxyToServer,
      POST: proxyToServer,
    },
  },
});
