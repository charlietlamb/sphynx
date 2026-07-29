import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/start-server-core/request-response";

/**
 * Better Auth's session cookie under its default prefix — `__Secure-` is added
 * over HTTPS. Presence is a best-effort hint used only to pick the first-paint
 * placeholder (skeleton vs landing) before the client session resolves; the
 * authoritative check is `useSession`.
 */
const SESSION_COOKIE_NAMES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
] as const;

export const getSessionHint = createServerFn().handler((): boolean =>
  SESSION_COOKIE_NAMES.some((name) => Boolean(getCookie(name)))
);
