import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    dedupe: ["react-dnd", "dnd-core", "nuqs"],
  },
  optimizeDeps: {
    // react-mosaic + our own HTML5 dnd manager must prebundle react-dnd into a
    // single shared instance. Only the packages we resolve directly are listed;
    // the MultiBackend chain is intentionally omitted (see use-mosaic-dnd-manager).
    include: [
      "react-mosaic-component",
      "react-dnd",
      "react-dnd-html5-backend",
      "dnd-core",
    ],
  },
  server: {
    port: 3006,
  },
  worker: {
    format: "es",
  },
  ssr: {
    // Workspace packages ship untranspiled TS/TSX, so bundle them into the SSR
    // build rather than externalizing them.
    noExternal: [/^@sphynx\//],
  },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    nitro(),
    // react's vite plugin must come after start's vite plugin
    viteReact(),
  ],
});
