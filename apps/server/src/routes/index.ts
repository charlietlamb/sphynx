import type { AuthInstance } from "@sphynx/auth";
import { handleAuth } from "./auth/handler";
import { handleHealth } from "./health/handler";
import { handleNotFound } from "./not-found/handler";

const isAuthPath = (pathname: string) =>
  pathname === "/api/auth" || pathname.startsWith("/api/auth/");

export const route = (request: Request, auth: AuthInstance) => {
  const { pathname } = new URL(request.url);

  if (pathname === "/healthz") {
    return handleHealth();
  }
  if (isAuthPath(pathname)) {
    return handleAuth(request, auth);
  }
  return handleNotFound();
};
