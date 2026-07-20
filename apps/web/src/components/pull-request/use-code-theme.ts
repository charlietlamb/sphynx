import { useTheme } from "next-themes";
import { useMemo } from "react";
import { useSettings } from "@/components/settings/settings-provider";
import { CODE_THEMES } from "@/lib/settings";

export function useCodeTheme() {
  const { resolvedTheme } = useTheme();
  const { settings } = useSettings();
  const themes = CODE_THEMES[settings.codeTheme]?.themes;
  return useMemo(
    () => ({
      themeType:
        resolvedTheme === "dark" ? ("dark" as const) : ("light" as const),
      ...(themes ? { theme: themes } : {}),
    }),
    [resolvedTheme, themes]
  );
}
