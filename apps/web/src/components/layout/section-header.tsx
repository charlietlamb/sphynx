import { cn } from "@sphynx/ui/lib/utils";
import type { ReactNode } from "react";

interface PaneHeaderLabelProps {
  count?: ReactNode;
  icon?: ReactNode;
  label: string;
}

export function PaneHeaderLabel({ count, icon, label }: PaneHeaderLabelProps) {
  return (
    <span className="flex min-w-0 shrink-0 items-center gap-2.5">
      {icon ? (
        <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground [&_svg]:size-3">
          {icon}
        </span>
      ) : null}
      <p className="font-heading font-medium text-foreground text-sm tracking-tight">
        {label}
      </p>
      {count === undefined ? null : (
        <span className="text-muted-foreground/60 text-xs tabular-nums">
          {count}
        </span>
      )}
    </span>
  );
}

interface SectionHeaderProps {
  action?: ReactNode;
  className?: string;
  count?: ReactNode;
  icon?: ReactNode;
  label: string;
}

export function SectionHeader({
  action,
  className,
  count,
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
      <PaneHeaderLabel count={count} icon={icon} label={label} />
      {action ?? null}
    </div>
  );
}
