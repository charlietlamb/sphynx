import { defineApp } from "convex/server";
import { v } from "convex/values";
import betterAuth from "./betterAuth/convex.config";

const app = defineApp({
  env: {
    AUTH_PUBLIC_URL: v.string(),
    AUTH_TRUSTED_ORIGINS: v.string(),
    BETTER_AUTH_SECRET: v.string(),
    GITHUB_APP_CLIENT_ID: v.string(),
    GITHUB_APP_CLIENT_SECRET: v.string(),
    GITHUB_APP_PRIVATE_KEY: v.string(),
    GITHUB_WEBHOOK_SECRET: v.string(),
    SITE_URL: v.string(),
  },
});
app.use(betterAuth);

export default app;
