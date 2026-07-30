import { DotsSixIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { Mosaic, type MosaicPath, MosaicWindow } from "react-mosaic-component";
import { ArrangeToggle } from "@/components/dashboard/arrange-toggle";
import { MosaicFallback } from "@/components/dashboard/mosaic-fallback";
import { useMosaicDndManager } from "@/components/dashboard/use-mosaic-dnd-manager";
import {
  type PaneId,
  useMosaicLayout,
} from "@/components/dashboard/use-mosaic-layout";
import { AppHeader } from "@/components/layout/app-header";
import { CARD_SURFACE, PaneCard } from "@/components/layout/pane-card";
import { useIsClient } from "@/lib/use-is-client";
import "react-mosaic-component/react-mosaic-component.css";
import "@/components/dashboard/mosaic-dashboard.css";

export type { PaneId } from "@/components/dashboard/use-mosaic-layout";

interface MosaicDashboardShellProps {
  dossier: ReactNode;
  githubUrl: string | null;
  queue: ReactNode;
  rail: ReactNode;
  railFooter?: ReactNode;
  switcher: ReactNode;
}

const PANE_TITLES: Record<PaneId, string> = {
  rail: "Flow",
  queue: "Pull requests",
  dossier: "Overview",
};

function renderPanePreview(title: string) {
  return (
    <div className="mosaic-pane-preview flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      <DotsSixIcon className="size-4 text-muted-foreground/50" weight="bold" />
      <span className="font-heading font-medium text-foreground text-sm tracking-tight">
        {title}
      </span>
    </div>
  );
}

export function MosaicDashboardShell({
  dossier,
  githubUrl,
  queue,
  rail,
  railFooter,
  switcher,
}: MosaicDashboardShellProps) {
  const isClient = useIsClient();
  const dndManager = useMosaicDndManager();
  const { arranging, layout, onChange, onRelease, reset, toggleArranging } =
    useMosaicLayout();

  const bodies: Record<PaneId, ReactNode> = {
    rail: (
      <PaneCard className="h-full">
        <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-3">
          {rail}
        </div>
        {railFooter}
      </PaneCard>
    ),
    queue: <PaneCard className="h-full">{queue}</PaneCard>,
    dossier,
  };

  const renderTile = (id: PaneId, path: MosaicPath) => (
    <MosaicWindow<PaneId>
      draggable
      path={path}
      renderPreview={() => renderPanePreview(PANE_TITLES[id])}
      renderToolbar={() =>
        arranging ? (
          <div
            className="absolute inset-0 cursor-grab active:cursor-grabbing"
            title={`Drag to rearrange ${PANE_TITLES[id]}`}
          />
        ) : (
          <div className="absolute inset-x-0 top-0 h-6" />
        )
      }
      title={PANE_TITLES[id]}
    >
      {bodies[id]}
    </MosaicWindow>
  );

  return (
    <main className="flex h-svh flex-col overflow-hidden bg-background text-foreground">
      <div className="flex flex-1 flex-col overflow-y-auto p-2.5 md:hidden">
        <PaneCard className="mb-2.5 h-auto">
          <AppHeader githubUrl={githubUrl} switcher={switcher} />
        </PaneCard>
        <PaneCard className="mb-2.5 h-[60vh]">
          <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
            {rail}
          </div>
          {railFooter}
        </PaneCard>
        <PaneCard className="mb-2.5 h-[100vh]">
          <section className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
            {queue}
          </section>
        </PaneCard>
        <div className="min-h-[100vh]">{dossier}</div>
      </div>
      <div className="hidden min-h-0 flex-1 flex-col md:flex">
        <div className="px-2.5 pt-2.5">
          <div className={CARD_SURFACE}>
            <AppHeader
              actions={
                <ArrangeToggle
                  arranging={arranging}
                  onReset={reset}
                  onToggle={toggleArranging}
                />
              }
              githubUrl={githubUrl}
              switcher={switcher}
            />
          </div>
        </div>
        <div
          className="relative min-h-0 flex-1"
          data-arranging={arranging ? "" : undefined}
        >
          {isClient ? (
            <div className="fade-in absolute inset-0 animate-in duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]">
              <Mosaic<PaneId>
                className="sphynx-mosaic"
                dragAndDropManager={dndManager}
                onChange={onChange}
                onRelease={onRelease}
                renderTile={renderTile}
                resize={{ minimumPaneSizePercentage: 12 }}
                value={layout}
              />
            </div>
          ) : (
            <MosaicFallback />
          )}
        </div>
      </div>
    </main>
  );
}
