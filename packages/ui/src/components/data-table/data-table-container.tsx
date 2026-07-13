import { Table } from "@sphynx/ui/components/ui/table";
import { cn } from "@sphynx/ui/lib/utils";
import type { ReactNode } from "react";

export function DataTableContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-auto rounded-lg border bg-card",
        className
      )}
    >
      <Table>{children}</Table>
    </div>
  );
}
