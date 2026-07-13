import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "drizzle-kit";

const envLine = /^DATABASE_URL=(.+)$/m;
const quotes = /^(['"])(.*)\1$/;
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const readDatabaseUrl = (path: string) => {
  if (!existsSync(path)) {
    return;
  }

  return readFileSync(path, "utf8")
    .match(envLine)?.[1]
    ?.trim()
    .replace(quotes, "$2");
};

const url = process.env.DATABASE_URL ?? readDatabaseUrl(resolve(root, ".env"));

export default defineConfig({
  dialect: "postgresql",
  ...(url ? { dbCredentials: { url } } : {}),
  out: "./drizzle",
  schema: "./src/schema.ts",
});
