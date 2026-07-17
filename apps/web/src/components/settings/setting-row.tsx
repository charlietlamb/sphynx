import type { ReactNode } from "react";

interface SettingRowProps {
  children: ReactNode;
  description: string;
  title: string;
}

export function SettingRow({ children, description, title }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between gap-6 py-3.5 first:pt-0 last:pb-0">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-sm">{title}</p>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
