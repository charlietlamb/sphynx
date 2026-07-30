import { cn } from "@sphynx/ui/lib/utils";
import type { ReactNode } from "react";

/**
 * Card chrome shared by every cards-on-canvas surface: rounded, hairline border,
 * card fill, subtle shadow. Use this constant for card frames that are not a
 * vertical content pane (e.g. a horizontal header bar); use `PaneCard` for a
 * flex-column content pane. Keeping the chrome in one place lets the dashboard
 * and the pull-request screen read as the same material.
 *
 * Note the `overflow-hidden` is the shorthand for both axes; a scrolling pane
 * must NOT layer `overflow-y-auto` on top of this (the shorthand wins in the
 * cascade and silently kills the scroll — and with it any `position: sticky`
 * child, which then binds to the wrong ancestor). Scrolling panes use
 * `SCROLL_CARD_SURFACE` instead, which sets the axes explicitly.
 */
const CARD_CHROME = "rounded-lg border border-border bg-card shadow-xs";

export const CARD_SURFACE = `overflow-hidden ${CARD_CHROME}`;

/**
 * A card that scrolls vertically. Rounds + clips like `CARD_SURFACE`, but sets
 * the two overflow axes explicitly (`overflow-x` clips, `overflow-y` scrolls) so
 * a sticky header inside it binds to this element rather than to some scrolling
 * ancestor.
 */
const SCROLL_CARD_SURFACE = `overflow-x-hidden overflow-y-auto ${CARD_CHROME}`;

/**
 * The cards-on-canvas surface shared by the dashboard panes and the pull-request
 * screen: a rounded, hairline-bordered card on the dark canvas. Pair with
 * `SectionHeader` for the standard h-11 header.
 */
export function PaneCard({
  children,
  className,
  scroll = false,
}: {
  children: ReactNode;
  className?: string;
  /**
   * Make the card its own vertical scroll container. Uses explicit overflow
   * axes instead of the `overflow-hidden` shorthand so a sticky header inside
   * sticks to this card rather than to a scrolling ancestor.
   */
  scroll?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col",
        scroll ? SCROLL_CARD_SURFACE : CARD_SURFACE,
        className
      )}
    >
      {children}
    </div>
  );
}
