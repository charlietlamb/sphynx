import { cn } from "@sphynx/ui/lib/utils";

/**
 * The diff-card chrome. The card border is drawn as an `::after` overlay so it
 * paints on top of pierre's full-width line fills (the green/red backgrounds
 * reach the card edge and would otherwise cover a plain border on the sides).
 * The overlay's radius rounds all four corners without an `overflow: hidden`
 * that would break the sticky file header.
 *
 * The overlay is anchored to the whole `diffs-container`, so once you scroll
 * into a file its top edge (and rounded top corners) scroll out of view while
 * pierre pins the file header (`DiffCardHeader`) at the top. So the card's top
 * chrome — top border, side borders, rounded top corners — lives on the header
 * itself (see `diff-card-header.tsx`), which is the element visible at the pinned
 * top; the `::after` overlay handles the rest of the frame and coincides with the
 * header's border at rest, so there is no double line.
 */
export const CARD_CLASSES = cn(
  "[&_diffs-container]:relative",
  "[&_diffs-container]:rounded-lg",
  "[&_diffs-container]:bg-card",
  "[&_diffs-container]:pb-2.5",
  "[&_diffs-container]:shadow-xs",
  "[&_diffs-container]:transition-colors",
  // Clip pierre's full-width line fills to the rounded corners. `clip-path`
  // rounds the content without making the container a scroll/containing block the
  // way `overflow: hidden` would — which would rebind the sticky file header to
  // the container and break the pin.
  "[&_diffs-container]:[clip-path:inset(0_round_var(--radius))]",
  "[&_diffs-container]:after:pointer-events-none",
  "[&_diffs-container]:after:absolute",
  "[&_diffs-container]:after:inset-0",
  "[&_diffs-container]:after:z-[5]",
  "[&_diffs-container]:after:rounded-lg",
  "[&_diffs-container]:after:border",
  "[&_diffs-container]:after:border-border"
);
