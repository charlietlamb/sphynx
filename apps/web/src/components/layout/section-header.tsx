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
        "sticky top-0 z-10 -mx-4 flex h-11 shrink-0 items-center justify-between gap-2 border-border border-b bg-card px-4",
        className
      )}
    >
      <span className="flex min-w-0 shrink-0 items-center gap-2.5">
        {icon ? (
          <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground [&_svg]:size-3">
            {icon}
          </span>
        ) : null}
        <p className="font-heading font-medium text-foreground text-sm tracking-tight">
          {label}
        </p>
      </span>
      {action ?? null}
    </div>
  );
}
