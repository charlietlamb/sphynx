import { SESSION_COOKIE_NAMES } from "@sphynx/auth/cookies";
import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";

export const getSessionHint = createServerFn().handler((): boolean =>
  SESSION_COOKIE_NAMES.some((name) => Boolean(getCookie(name)))
);
