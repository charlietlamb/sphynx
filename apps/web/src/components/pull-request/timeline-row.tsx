import { cn } from "@sphynx/ui/lib/utils";
import type { ReactNode } from "react";

interface TimelineRowProps {
  children: ReactNode;
  /** The final row stops the rail at its node instead of running to the bottom. */
  last?: boolean;
  /** The node threaded onto the rail: an avatar for comments, a dot for events. */
  node: ReactNode;
  /** `card` gives a comment its own breathing room; `row` is a compact event line. */
  variant: "card" | "row";
}

const RAIL = "w-7";

export function TimelineRow({
  node,
  variant,
  last = false,
  children,
}: TimelineRowProps) {
  return (
    <div className="relative flex gap-3">
      <div className={cn("relative flex shrink-0 justify-center", RAIL)}>
        <span
          aria-hidden
          className={cn(
            "absolute top-0 left-1/2 w-px -translate-x-1/2 bg-border",
            last ? "h-3.5" : "bottom-0"
          )}
        />
        <span className="relative flex items-start pt-0.5">{node}</span>
      </div>
      <div
        className={cn(
          "min-w-0 flex-1",
          variant === "row" ? "flex min-h-5 items-center pb-4" : "pb-5"
        )}
      >
        {children}
      </div>
    </div>
  );
}
