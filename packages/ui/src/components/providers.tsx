"use client";

import { ThemeProvider } from "@sphynx/ui/components/theme-provider";
import { Toaster } from "@sphynx/ui/components/ui/sonner";
import { TooltipProvider } from "@sphynx/ui/components/ui/tooltip";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider>{children}</TooltipProvider>
      <Toaster />
    </ThemeProvider>
  );
}
