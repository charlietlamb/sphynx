import { cn } from "@sphynx/ui/lib/utils";
import type { ReactNode } from "react";

interface SectionHeaderProps {
  action?: ReactNode;
  className?: string;
  label: string;
}

export function SectionHeader({
  action,
  className,
  label,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "sticky top-0 z-10 -mx-5 mb-2 flex items-center justify-between border-border border-b bg-background px-5 pt-3 pb-2",
        className
      )}
    >
      <p className="font-medium text-[11px] text-muted-foreground/60">
        {label}
      </p>
      {action ?? null}
    </div>
  );
}
