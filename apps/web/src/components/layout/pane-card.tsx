import { cn } from "@sphynx/ui/lib/utils";
import type { ReactNode } from "react";

/**
 * Card chrome shared by every cards-on-canvas surface: rounded, hairline border,
 * card fill, subtle shadow. Use this constant for card frames that are not a
 * vertical content pane (e.g. a horizontal header bar); use `PaneCard` for a
 * flex-column content pane. Keeping the chrome in one place lets the dashboard
 * and the pull-request screen read as the same material.
 */
export const CARD_SURFACE =
  "overflow-hidden rounded-lg border border-border bg-card shadow-xs";

/**
 * The cards-on-canvas surface shared by the dashboard panes and the pull-request
 * screen: a rounded, hairline-bordered card on the dark canvas. Pair with
 * `SectionHeader` for the standard h-11 header.
 */
export function PaneCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-0 flex-col", CARD_SURFACE, className)}>
      {children}
    </div>
  );
}
