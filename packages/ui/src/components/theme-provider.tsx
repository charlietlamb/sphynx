"use client";

import { useThemeHotkey } from "@sphynx/ui/hooks/use-theme-hotkey";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      disableTransitionOnChange
      enableSystem
      {...props}
    >
      <ThemeHotkey />
      {children}
    </NextThemesProvider>
  );
}

function ThemeHotkey() {
  useThemeHotkey();
  return null;
}

export { ThemeProvider };
