import convexPlugin from "@convex-dev/eslint-plugin";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["convex/_generated/**", "convex/betterAuth/_generated/**"] },
  ...tseslint.configs.recommendedTypeChecked,
  ...convexPlugin.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@convex-dev/no-collect-in-query": "error",
    },
  }
);
