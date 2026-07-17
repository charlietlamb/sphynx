import { useQuery } from "@tanstack/react-query";
import { mirroredThemeQuery } from "@/lib/mirrored-theme";
import { CODE_THEMES, useSettings } from "@/lib/settings";

export function MirroredThemeStyle() {
  const { settings } = useSettings();
  const themes = settings.mirrorCodeTheme
    ? CODE_THEMES[settings.codeTheme]?.themes
    : undefined;
  const { data: css } = useQuery(mirroredThemeQuery(themes));
  if (!css) {
    return null;
  }
  return <style>{css}</style>;
}
