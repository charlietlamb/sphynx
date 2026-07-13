import type { AuthInstance } from "@sphynx/auth";

export const handleAuth = (request: Request, auth: AuthInstance) =>
  auth.handler(request);
