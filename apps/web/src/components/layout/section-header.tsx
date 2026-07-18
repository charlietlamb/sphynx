import { cn } from "@sphynx/ui/lib/utils";
import type { ReactNode } from "react";

interface SectionHeaderProps {
  action?: ReactNode;
  className?: string;
  icon?: ReactNode;
  label: string;
}

export function SectionHeader({
  action,
  className,
  icon,
  label,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "sticky top-0 z-10 -mx-5 mb-2 flex items-center justify-between border-border border-b bg-background px-5 py-2.5",
        className
      )}
    >
      <span className="flex items-center gap-1.5">
        <span className="text-muted-foreground/60">{icon}</span>
        <p className="font-medium text-[11px] text-foreground">{label}</p>
      </span>
      {action ?? null}
    </div>
  );
}
