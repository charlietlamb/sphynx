/// <reference types="vite/client" />
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { RootDocument } from "@/components/layout/root-document";
import { RootErrorComponent } from "@/components/layout/root-error";
import { RootNotFound } from "@/components/layout/root-not-found";
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
