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
  // Only the bottom corners round: the top butts flush against the pinned file
  // header (which owns the rounded top), so the code fills run edge-to-edge under
  // it like GitHub, with no inset rounding or card-coloured gap at the seam.
  "[&_diffs-container]:rounded-b-lg",
  "[&_diffs-container]:bg-card",
  "[&_diffs-container]:shadow-xs",
  "[&_diffs-container]:transition-colors",
  // Round pierre's full-width line fills to the card corners. The fills render in
  // this element's shadow DOM (`[data-code]`, square corners, `overflow-x:
  // scroll`), which light-DOM CSS can't reach — so the only way to round them is
  // to clip the host to its own `border-radius`. `border-radius` clips a corner
  // only on an axis whose overflow is not `visible`, so both axes must be `clip`;
  // with `overflow-y: visible` the square shadow corners showed through the
  // rounded bottom. `clip` (unlike `hidden`) creates no scroll container, and
  // the vertical scroll + sticky header live on the outer `overflow-y-auto`
  // ancestor, not here, so clipping both axes here is safe. No bottom padding, so
  // the last line's fill reaches the rounded bottom edge with no gap.
  "[&_diffs-container]:overflow-clip",
  "[&_diffs-container]:after:pointer-events-none",
  "[&_diffs-container]:after:absolute",
  "[&_diffs-container]:after:inset-0",
  "[&_diffs-container]:after:z-[5]",
  "[&_diffs-container]:after:rounded-b-lg",
  "[&_diffs-container]:after:border-x",
  "[&_diffs-container]:after:border-b",
  "[&_diffs-container]:after:border-border"
);
