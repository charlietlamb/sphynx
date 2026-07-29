import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start";

const convexUrl = import.meta.env.VITE_CONVEX_URL;
const convexSiteUrl = import.meta.env.VITE_CONVEX_SITE_URL;

if (!(convexUrl && convexSiteUrl)) {
  throw new Error("VITE_CONVEX_URL and VITE_CONVEX_SITE_URL must be set");
}

export const { getToken, handler } = convexBetterAuthReactStart({
  convexUrl,
  convexSiteUrl,
});
