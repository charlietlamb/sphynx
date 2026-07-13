/// <reference types="vite/client" />
import { Providers } from "@sphynx/ui/components/providers";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRoute,
  type ErrorComponentProps,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ErrorCard } from "@/components/layout/error-card";
import { getQueryClient } from "@/lib/query/query-client";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "@fontsource-variable/fraunces";
import "../styles/globals.css";

export const Route = createRootRoute({
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
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootErrorComponent({ error, reset }: ErrorComponentProps) {
  return (
    <RootDocument>
      <ErrorCard
        description="Something went wrong while loading this page."
        detail={error.message}
        onRetry={reset}
        title="Unexpected error"
      />
    </RootDocument>
  );
}

function RootNotFound() {
  return (
    <RootDocument>
      <ErrorCard
        description="We couldn't find the page you were looking for."
        title="Page not found"
      />
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html className="font-sans antialiased" lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={getQueryClient()}>
          <Providers>{children}</Providers>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
