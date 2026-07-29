import convexPlugin from "@convex-dev/eslint-plugin";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["convex/_generated/**"] },
  ...tseslint.configs.recommended,
  ...convexPlugin.configs.recommended,
);
