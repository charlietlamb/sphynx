import { cn } from "@sphynx/ui/lib/utils";

/**
 * The diff-card chrome. The frame is split between two non-overlapping regions so
 * no border is ever drawn twice: the file header (`diff-card-header.tsx`) owns the
 * top — top border, side borders and rounded top corners — and stays visible
 * because pierre pins it while scrolling, so the rounded top follows the pinned
 * header instead of scrolling away. The `::after` overlay owns everything below
 * the header: side borders, bottom border and rounded bottom corners, painted on
 * top of pierre's full-width line fills (the green/red backgrounds reach the card
 * edge and would otherwise cover a plain border). The overlay starts at the
 * header's height (`top-11` = the `h-11` header), so the two never share a row and
 * the outline never doubles at the corners.
 */
export const CARD_CLASSES = cn(
  "[&_diffs-container]:relative",
  "[&_diffs-container]:rounded-lg",
  "[&_diffs-container]:bg-card",
  "[&_diffs-container]:shadow-xs",
  "[&_diffs-container]:transition-colors",
  // Clip pierre's full-width line fills to the rounded card. The fills render in
  // this element's shadow DOM; a light-DOM clip on the host rounds the corners.
  // The transient sliver that used to bleed past the top corner while scrolling
  // was pierre's rounded sticky header painting its notch over the fill behind it
  // — squared away via pierre's `unsafeCSS` option in `diff-card-list`, not here.
  "[&_diffs-container]:overflow-clip",
  "[&_diffs-container]:after:pointer-events-none",
  "[&_diffs-container]:after:absolute",
  "[&_diffs-container]:after:top-11",
  "[&_diffs-container]:after:inset-x-0",
  "[&_diffs-container]:after:bottom-0",
  "[&_diffs-container]:after:z-[5]",
  "[&_diffs-container]:after:rounded-b-lg",
  "[&_diffs-container]:after:border-x",
  "[&_diffs-container]:after:border-b",
  "[&_diffs-container]:after:border-border"
);
