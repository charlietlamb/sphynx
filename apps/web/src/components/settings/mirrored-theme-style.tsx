import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { useSettings } from "@/components/settings/settings-provider";
import { mirroredThemeQuery } from "@/lib/mirrored-theme";
import { CODE_THEMES } from "@/lib/settings";

export function MirroredThemeStyle({
  initialCss,
}: {
  initialCss: string | null;
}) {
  const { settings } = useSettings();
  const themes = settings.mirrorCodeTheme
    ? CODE_THEMES[settings.codeTheme]?.themes
    : undefined;
  const ssrThemes = useRef(themes);
  const isSsrTheme =
    themes !== undefined &&
    ssrThemes.current !== undefined &&
    themes.light === ssrThemes.current.light &&
    themes.dark === ssrThemes.current.dark;
  const { data: css } = useQuery({
    ...mirroredThemeQuery(themes),
    initialData: isSsrTheme && initialCss ? initialCss : undefined,
  });
  if (!css) {
    return null;
  }
  return <style>{css}</style>;
}
