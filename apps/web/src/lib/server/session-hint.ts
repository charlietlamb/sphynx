import { SESSION_COOKIE_NAMES } from "@sphynx/auth/cookies";
import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/start-server-core/request-response";

export const getSessionHint = createServerFn().handler((): boolean =>
  SESSION_COOKIE_NAMES.some((name) => Boolean(getCookie(name)))
);
