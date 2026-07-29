import { ConvexQueryClient } from "@convex-dev/react-query";

const convexUrl = import.meta.env.VITE_CONVEX_URL;

if (!convexUrl) {
  throw new Error("VITE_CONVEX_URL is not set");
}

export const convexQueryClient = new ConvexQueryClient(convexUrl, {
  expectAuth: true,
});
