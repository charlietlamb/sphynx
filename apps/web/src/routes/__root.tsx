/// <reference types="vite/client" />
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { RootDocument } from "@/components/layout/root-document";
import { RootErrorComponent } from "@/components/layout/root-error";
import { RootNotFound } from "@/components/layout/root-not-found";
import { loadMirroredCss } from "@/lib/mirrored-theme";
import { getServerSettings } from "@/lib/server/settings-cookie";
import { CODE_THEMES, clientSettings } from "@/lib/settings";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "@fontsource-variable/instrument-sans";
import "../styles/globals.css";

export const Route = createRootRoute({
  loader: async () => {
    const settings =
      typeof document === "undefined"
        ? await getServerSettings()
        : clientSettings();
    const themes = settings.mirrorCodeTheme
      ? CODE_THEMES[settings.codeTheme]?.themes
      : undefined;
    return { settings, mirroredCss: await loadMirroredCss(themes) };
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Sphynx · Code review with context" },
      {
        name: "description",
        content: "Review pull requests with the context your team needs.",
      },
    ],
    links: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
  }),
  component: RootComponent,
  errorComponent: RootErrorComponent,
  notFoundComponent: RootNotFound,
});

function RootComponent() {
  const { settings, mirroredCss } = Route.useLoaderData();
  return (
    <RootDocument initialMirroredCss={mirroredCss} initialSettings={settings}>
      <Outlet />
    </RootDocument>
  );
}
