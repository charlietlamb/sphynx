import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@sphynx/ui/components/ui/resizable";
import type { ReactNode } from "react";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";

interface DashboardShellProps {
  dossier: ReactNode;
  githubUrl: string | null;
  hints: ReactNode;
  queue: ReactNode;
  rail: ReactNode;
  switcher: ReactNode;
}

export function DashboardShell({
  dossier,
  githubUrl,
  hints,
  queue,
  rail,
  switcher,
}: DashboardShellProps) {
  return (
    <main className="flex h-svh flex-col overflow-hidden bg-background text-foreground">
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
          <section className="no-scrollbar flex h-full min-h-0 flex-col overflow-y-auto px-4 py-3">
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
      <footer className="flex items-center justify-end gap-4 border-border border-t px-4 py-1.5">
        {hints}
      </footer>
    </main>
  );
}
