import type { ReactNode } from "react";
import { PanelCard } from "@/components/layout/panel-card";

interface NoticePanelProps {
  action?: ReactNode;
  description: string;
  title: string;
}

export function NoticePanel({ action, description, title }: NoticePanelProps) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-4">
      <PanelCard description={description} title={title}>
        {action ? <div className="mt-3">{action}</div> : null}
      </PanelCard>
    </div>
  );
}
