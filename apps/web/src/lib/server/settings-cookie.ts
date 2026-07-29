import { createServerFn } from "@tanstack/react-start";
import {
  getCookie,
  setCookie,
} from "@tanstack/start-server-core/request-response";
import {
  COOKIE_MAX_AGE,
  decodeReviewSettings,
  parseSettings,
  type ReviewSettings,
  SETTINGS_COOKIE,
} from "@/lib/settings";

export const getServerSettings = createServerFn().handler(
  (): ReviewSettings => parseSettings(getCookie(SETTINGS_COOKIE))
);

export const saveServerSettings = createServerFn({ method: "POST" })
  .validator((data: unknown) => decodeReviewSettings(data))
  .handler(({ data }) => {
    setCookie(SETTINGS_COOKIE, encodeURIComponent(JSON.stringify(data)), {
      httpOnly: false,
      maxAge: COOKIE_MAX_AGE,
      path: "/",
      sameSite: "lax",
    });
  });
