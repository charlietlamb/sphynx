import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@sphynx/ui/components/ui/resizable";
import type { ReactNode } from "react";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { NoticePanel } from "@/components/layout/notice-panel";

interface DashboardShellProps {
  dossier: ReactNode;
  githubUrl: string | null;
  queue: ReactNode;
  rail: ReactNode;
  switcher: ReactNode;
}

export function DashboardShell({
  dossier,
  githubUrl,
  queue,
  rail,
  switcher,
}: DashboardShellProps) {
  return (
    <main className="flex h-svh flex-col overflow-hidden bg-background text-foreground">
      <div className="flex flex-1 flex-col md:hidden">
        <NoticePanel
          description="Open Sphynx on a larger screen to work the review queue."
          title="Sphynx is better on desktop"
        />
      </div>
      <div className="hidden min-h-0 flex-1 flex-col md:flex">
        <DashboardHeader githubUrl={githubUrl} switcher={switcher} />
        <ResizablePanelGroup
          autoSaveId="sphynx-dashboard"
          className="min-h-0 flex-1"
          direction="horizontal"
        >
          <ResizablePanel defaultSize={17} minSize={12}>
            <aside className="no-scrollbar flex h-full min-h-0 flex-col overflow-y-auto px-3 py-3">
              {rail}
            </aside>
          </ResizablePanel>
          <ResizableHandle className="bg-border" />
          <ResizablePanel defaultSize={53} minSize={30}>
            <section className="no-scrollbar flex h-full min-h-0 flex-col overflow-y-auto">
              {queue}
            </section>
          </ResizablePanel>
          <ResizableHandle className="bg-border" />
          <ResizablePanel defaultSize={30} minSize={20}>
            <aside className="no-scrollbar flex h-full min-h-0 flex-col overflow-y-auto">
              {dossier}
            </aside>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </main>
  );
}
