"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";
import { isTypingTarget } from "@sphynx/ui/lib/typing-target";

type UseThemeHotkeyOptions = {
  key?: string;
  enabled?: boolean;
};

export function useThemeHotkey({
  key = "t",
  enabled = process.env.NODE_ENV === "development",
}: UseThemeHotkeyOptions = {}): void {
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (event.defaultPrevented || event.repeat) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key?.toLowerCase() !== key) {
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      setTheme(resolvedTheme === "dark" ? "light" : "dark");
    }

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, key, resolvedTheme, setTheme]);
}
