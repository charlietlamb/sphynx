import { cn } from "@sphynx/ui/lib/utils";

/**
 * The diff-card chrome. The card border is drawn as an `::after` overlay so it
 * paints on top of pierre's full-width line fills (the green/red backgrounds
 * reach the card edge and would otherwise cover a plain border on the sides).
 * The overlay's radius rounds all four corners without an `overflow: hidden`
 * that would break the sticky file header.
 */
export const CARD_CLASSES = cn(
  "[&_diffs-container]:relative",
  "[&_diffs-container]:rounded-lg",
  "[&_diffs-container]:bg-card",
  "[&_diffs-container]:pb-2.5",
  "[&_diffs-container]:shadow-xs",
  "[&_diffs-container]:transition-colors",
  "[&_diffs-container]:after:pointer-events-none",
  "[&_diffs-container]:after:absolute",
  "[&_diffs-container]:after:inset-0",
  "[&_diffs-container]:after:z-[5]",
  "[&_diffs-container]:after:rounded-lg",
  "[&_diffs-container]:after:border",
  "[&_diffs-container]:after:border-border"
);
