import { cn } from "@sphynx/ui/lib/utils";

export const CARD_CLASSES = cn(
  "[&_diffs-container]:rounded-md",
  "[&_diffs-container]:border",
  "[&_diffs-container]:border-border",
  "[&_diffs-container]:overflow-clip",
  "[&_diffs-container]:transition-[color,border-color,box-shadow]",
  "[&_diffs-container[data-active]]:border-ring",
  "[&_diffs-container[data-active]]:shadow-[0_0_0_1px_var(--ring)]"
);
