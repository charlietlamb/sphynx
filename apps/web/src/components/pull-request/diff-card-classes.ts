import { cn } from "@sphynx/ui/lib/utils";

/**
 * The diff-card chrome. The whole card frame — all four borders and rounded
 * corners — is a single `::after` overlay on `diffs-container`, painted on top of
 * pierre's full-width line fills (the green/red backgrounds reach the card edge
 * and would otherwise cover a plain border). One element owns the frame, so the
 * file header (`diff-card-header.tsx`) draws only its bottom divider — no second
 * set of side/top borders offset by a pixel, which used to double the outline at
 * the top corners.
 */
export const CARD_CLASSES = cn(
  "[&_diffs-container]:relative",
  "[&_diffs-container]:rounded-lg",
  "[&_diffs-container]:bg-card",
  "[&_diffs-container]:shadow-xs",
  "[&_diffs-container]:transition-colors",
  // Clip pierre's full-width line fills (green/red backgrounds that reach the card
  // edge) to the rounded card. The fills render in this element's shadow DOM; a
  // light-DOM clip on the host rounds the settled corners. The transient sliver
  // that used to bleed past the top corner while scrolling was pierre's rounded
  // sticky header painting its notch over the fill behind it — squared away via
  // pierre's `unsafeCSS` option in `diff-card-list`, not here.
  "[&_diffs-container]:overflow-clip",
  "[&_diffs-container]:after:pointer-events-none",
  "[&_diffs-container]:after:absolute",
  "[&_diffs-container]:after:inset-0",
  "[&_diffs-container]:after:z-[5]",
  "[&_diffs-container]:after:rounded-lg",
  "[&_diffs-container]:after:border",
  "[&_diffs-container]:after:border-border"
);
