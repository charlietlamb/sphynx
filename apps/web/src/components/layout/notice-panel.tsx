import type { ReactNode } from "react";

interface NoticePanelProps {
  action?: ReactNode;
  description: string;
  title: string;
}

export function NoticePanel({ action, description, title }: NoticePanelProps) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-4">
      <div className="w-full max-w-md border border-border bg-background p-8 text-left">
        <div className="flex flex-col gap-3">
          <h2 className="font-heading text-2xl tracking-tight">{title}</h2>
          <p className="text-muted-foreground text-sm">{description}</p>
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}
