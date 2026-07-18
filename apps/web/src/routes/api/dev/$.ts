import { createFileRoute } from "@tanstack/react-router";
import { proxyToServer } from "@/lib/server/proxy";

export const Route = createFileRoute("/api/dev/$")({
  server: {
    handlers: {
      GET: proxyToServer,
    },
  },
});
