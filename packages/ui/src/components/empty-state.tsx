import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@sphynx/ui/components/ui/empty";
import { cn } from "@sphynx/ui/lib/utils";
import type { ReactNode } from "react";

interface EmptyStateProps {
  action?: ReactNode;
  bordered?: boolean;
  className?: string;
  description?: ReactNode;
  icon?: ReactNode;
  texture?: boolean;
  title: string;
}

export function EmptyState({
  action,
  bordered = true,
  className,
  description,
  icon,
  texture = false,
  title,
}: EmptyStateProps) {
  return (
    <Empty
      className={cn(
        "relative overflow-hidden",
        bordered && "border",
        className
      )}
    >
      {texture ? (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-center bg-cover opacity-[0.05] dark:hidden"
            style={{ backgroundImage: "url(/mountains-dither.webp)" }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 hidden bg-center bg-cover opacity-[0.06] dark:block"
            style={{ backgroundImage: "url(/mountains-dither-dark.webp)" }}
          />
        </>
      ) : null}
      <EmptyHeader className="relative">
        {icon ? <EmptyMedia variant="icon">{icon}</EmptyMedia> : null}
        <EmptyTitle>{title}</EmptyTitle>
        {description ? (
          <EmptyDescription>{description}</EmptyDescription>
        ) : null}
      </EmptyHeader>
      {action ? (
        <EmptyContent className="relative">{action}</EmptyContent>
      ) : null}
    </Empty>
  );
}
