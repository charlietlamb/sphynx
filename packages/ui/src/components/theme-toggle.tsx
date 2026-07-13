"use client";

import { Moon, Sun } from "@phosphor-icons/react";
import { Button } from "@sphynx/ui/components/ui/button";
import { useTheme } from "next-themes";

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const toggle = (): void =>
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  return (
    <Button
      aria-label="Toggle theme"
      onClick={toggle}
      size="icon-sm"
      variant="outline"
    >
      <Sun className="hidden dark:block" weight="fill" />
      <Moon className="block dark:hidden" weight="fill" />
    </Button>
  );
}

export { ThemeToggle };
