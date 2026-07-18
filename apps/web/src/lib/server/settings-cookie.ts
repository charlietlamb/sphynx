import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import {
  COOKIE_MAX_AGE,
  parseSettings,
  type ReviewSettings,
  SETTINGS_COOKIE,
} from "@/lib/settings";

export const getServerSettings = createServerFn().handler(
  (): ReviewSettings => parseSettings(getCookie(SETTINGS_COOKIE))
);

export const saveServerSettings = createServerFn({ method: "POST" })
  .inputValidator((data: ReviewSettings) => data)
  .handler(({ data }) => {
    setCookie(SETTINGS_COOKIE, encodeURIComponent(JSON.stringify(data)), {
      httpOnly: false,
      maxAge: COOKIE_MAX_AGE,
      path: "/",
      sameSite: "lax",
    });
  });
