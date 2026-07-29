import { writeFileSync } from "node:fs";
import { getAuthTables } from "better-auth/db";
import { organization } from "better-auth/plugins";
import { getAuthConfigProvider } from "../node_modules/@convex-dev/better-auth/dist/auth-config.js";
import { createSchema } from "../node_modules/@convex-dev/better-auth/dist/client/create-schema.js";
import { convex } from "../node_modules/@convex-dev/better-auth/dist/plugins/index.js";

/**
 * Regenerate convex/betterAuth/schema.ts (the self-owned Better Auth Local
 * Install schema). Run after changing auth plugins:
 *   node scripts/generate-auth-schema.mjs
 */
const authConfig = { providers: [getAuthConfigProvider()] };
const options = {
  plugins: [organization(), convex({ authConfig })],
  socialProviders: {},
};
const tables = getAuthTables(options);
const { code } = await createSchema({ tables, file: "./schema.ts" });
writeFileSync("convex/betterAuth/schema.ts", code);
console.log(
  "wrote convex/betterAuth/schema.ts:",
  Object.keys(tables).join(", ")
);
