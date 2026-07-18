import { cn } from "@sphynx/ui/lib/utils";

export const CARD_CLASSES = cn(
  "[&_diffs-container]:rounded-none",
  "[&_diffs-container]:border",
  "[&_diffs-container]:border-border",
  "[&_diffs-container]:overflow-clip",
  "[&_diffs-container]:transition-colors",
  "[&_diffs-container[data-active]]:border-primary/40"
);
