/// <reference types="vite/client" />
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import type { ConvexQueryClient } from "@convex-dev/react-query";
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ComponentProps } from "react";
import { RootDocument } from "@/components/layout/root-document";
import { RootErrorComponent } from "@/components/layout/root-error";
import { RootNotFound } from "@/components/layout/root-not-found";
import { authClient } from "@/lib/auth-client";
import { getToken } from "@/lib/auth-server";
import { loadMirroredCss } from "@/lib/mirrored-theme";
import { getServerSettings } from "@/lib/server/settings-cookie";
import { CODE_THEMES, clientSettings } from "@/lib/settings";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "@fontsource-variable/funnel-display";
import "../styles/globals.css";

const fetchToken = createServerFn({ method: "GET" }).handler(() => getToken());
const providerAuthClient = authClient as unknown as ComponentProps<
  typeof ConvexBetterAuthProvider
>["authClient"];

interface RouterContext {
  convexQueryClient: ConvexQueryClient;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async (ctx) => {
    const token = await fetchToken();
    if (token) {
      ctx.context.convexQueryClient.serverHttpClient?.setAuth(token);
    }
    return { token };
  },
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
  const { token, convexQueryClient, queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <ConvexBetterAuthProvider
        authClient={providerAuthClient}
        client={convexQueryClient.convexClient}
        initialToken={token}
      >
        <RootDocument
          initialMirroredCss={mirroredCss}
          initialSettings={settings}
        >
          <Outlet />
        </RootDocument>
      </ConvexBetterAuthProvider>
    </QueryClientProvider>
  );
}
