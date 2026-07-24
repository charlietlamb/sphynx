import { cn } from "@sphynx/ui/lib/utils";
import type { ReactNode } from "react";

interface TimelineRowProps {
  children: ReactNode;
  /** The final row stops the rail at its node instead of running to the bottom. */
  last?: boolean;
  /** The node threaded onto the rail: an avatar for cards, an icon for rows. */
  node: ReactNode;
  /** `card` aligns the node with a card's header line; `row` with the single line. */
  variant: "card" | "row";
}

const GUTTER = "w-10";
const NODE_TOP = { card: "1.375rem", row: "0.875rem" } as const;

export function TimelineRow({
  node,
  variant,
  last = false,
  children,
}: TimelineRowProps) {
  return (
    <div className="relative flex">
      <div className={cn("relative shrink-0", GUTTER)}>
        <span
          aria-hidden
          className={cn(
            "absolute top-0 left-1/2 w-px -translate-x-1/2 bg-border",
            last ? "h-[var(--node-top)]" : "h-full"
          )}
          style={{ "--node-top": NODE_TOP[variant] } as React.CSSProperties}
        />
        <span
          className="absolute left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-background"
          style={{ top: NODE_TOP[variant] }}
        >
          {node}
        </span>
      </div>
      <div
        className={cn(
          "min-w-0 flex-1",
          variant === "row" ? "flex min-h-7 items-center pb-1" : "pb-3"
        )}
      >
        {children}
      </div>
    </div>
  );
}
