import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@sphynx/ui/components/ui/resizable";
import type { ReactNode } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { NoticePanel } from "@/components/layout/notice-panel";

interface DashboardShellProps {
  dossier: ReactNode;
  githubUrl: string | null;
  queue: ReactNode;
  rail: ReactNode;
  railFooter?: ReactNode;
  switcher: ReactNode;
}

export function DashboardShell({
  dossier,
  githubUrl,
  queue,
  rail,
  railFooter,
  switcher,
}: DashboardShellProps) {
  return (
    <main className="flex h-svh min-h-[640px] flex-col overflow-hidden bg-background text-foreground">
      <div className="flex flex-1 flex-col md:hidden">
        <NoticePanel
          description="Open Sphynx on a larger screen to work the review queue."
          title="Sphynx is better on desktop"
        />
      </div>
      <div className="hidden min-h-0 flex-1 flex-col md:flex">
        <div className="px-2.5 pt-2.5">
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
            <AppHeader githubUrl={githubUrl} switcher={switcher} />
          </div>
        </div>
        <ResizablePanelGroup
          autoSaveId="sphynx-dashboard"
          className="min-h-0 flex-1"
          direction="horizontal"
        >
          <ResizablePanel defaultSize={17} minSize={12}>
            <aside className="flex h-full min-h-0 flex-col p-2.5 pt-[13px] pr-1.5">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xs">
                <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
                  {rail}
                </div>
                {railFooter}
              </div>
            </aside>
          </ResizablePanel>
          <ResizableHandle className="bg-transparent" />
          <ResizablePanel defaultSize={53} minSize={30}>
            <section className="flex h-full min-h-0 flex-col p-2.5 px-1.5 pt-[13px]">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xs">
                <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
                  {queue}
                </div>
              </div>
            </section>
          </ResizablePanel>
          <ResizableHandle className="bg-transparent" />
          <ResizablePanel defaultSize={30} minSize={20}>
            <aside className="flex h-full min-h-0 flex-col p-2.5 pt-[13px] pl-1.5">
              {dossier}
            </aside>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </main>
  );
}
