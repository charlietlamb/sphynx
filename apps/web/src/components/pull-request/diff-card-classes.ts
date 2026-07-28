import { cn } from "@sphynx/ui/lib/utils";

export const CARD_CLASSES = cn(
  "[&_diffs-container]:rounded-lg",
  "[&_diffs-container]:border",
  "[&_diffs-container]:border-border",
  "[&_diffs-container]:bg-card",
  "[&_diffs-container]:shadow-xs",
  "[&_diffs-container]:overflow-hidden",
  "[&_diffs-container]:transition-colors"
);
