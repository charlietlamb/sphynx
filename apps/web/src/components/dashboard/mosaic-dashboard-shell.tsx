import { DotsSixIcon } from "@phosphor-icons/react";
import { cn } from "@sphynx/ui/lib/utils";
import type { ReactNode } from "react";
import { Mosaic, type MosaicPath, MosaicWindow } from "react-mosaic-component";
import { ArrangeToggle } from "@/components/dashboard/arrange-toggle";
import { useIsClient } from "@/components/dashboard/use-is-client";
import {
  DEFAULT_SPLITS,
  type PaneId,
  useMosaicLayout,
} from "@/components/dashboard/use-mosaic-layout";
import { AppHeader } from "@/components/layout/app-header";
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

const CARD =
  "flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xs";

const PANE_TITLES: Record<PaneId, string> = {
  rail: "Flow",
  queue: "Pull requests",
  dossier: "Overview",
};

function GrabHandle() {
  return (
    <div className="mosaic-grab pointer-events-none absolute inset-x-0 top-0 z-20 flex h-6 items-center justify-center text-muted-foreground/40 transition-opacity duration-150 group-hover/tile:text-muted-foreground/70">
      <DotsSixIcon className="size-4" weight="bold" />
    </div>
  );
}

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
  const {
    arranging,
    layout,
    onChange,
    onRelease,
    reset,
    resizing,
    toggleArranging,
  } = useMosaicLayout();

  const bodies: Record<PaneId, ReactNode> = {
    rail: (
      <div className={CARD}>
        <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
          {rail}
        </div>
        {railFooter}
      </div>
    ),
    queue: (
      <div className={CARD}>
        <section className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
          {queue}
        </section>
      </div>
    ),
    dossier: (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {dossier}
      </div>
    ),
  };

  const renderTile = (id: PaneId, path: MosaicPath) => (
    <MosaicWindow<PaneId>
      className="group/tile relative"
      draggable={arranging}
      path={path}
      renderPreview={() => renderPanePreview(PANE_TITLES[id])}
      renderToolbar={() => (
        <div
          className={cn(
            "absolute inset-x-0 top-0 h-6",
            arranging && "cursor-grab active:cursor-grabbing"
          )}
          title={arranging ? `Drag to rearrange ${PANE_TITLES[id]}` : undefined}
        />
      )}
      title={PANE_TITLES[id]}
    >
      {arranging ? <GrabHandle /> : null}
      {bodies[id]}
    </MosaicWindow>
  );

  return (
    <main className="flex h-svh min-h-[640px] flex-col overflow-hidden bg-background text-foreground">
      <div className="flex flex-1 flex-col overflow-y-auto p-2.5 md:hidden">
        <div className={cn("mb-2.5 overflow-hidden", CARD, "h-auto")}>
          <AppHeader githubUrl={githubUrl} switcher={switcher} />
        </div>
        <div className={cn("mb-2.5 h-[60vh]", CARD)}>
          <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
            {rail}
          </div>
          {railFooter}
        </div>
        <div className={cn("mb-2.5 h-[100vh]", CARD)}>
          <section className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
            {queue}
          </section>
        </div>
        <div className="min-h-[100vh]">{dossier}</div>
      </div>
      <div className="hidden min-h-0 flex-1 flex-col md:flex">
        <div className="px-2.5 pt-2.5">
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
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
          data-resizing={resizing ? "" : undefined}
        >
          {isClient ? (
            <Mosaic<PaneId>
              className="sphynx-mosaic"
              onChange={onChange}
              onRelease={onRelease}
              renderTile={renderTile}
              resize={{ minimumPaneSizePercentage: 12 }}
              value={layout}
            />
          ) : (
            <div className="absolute inset-1.5 flex gap-[13px]">
              {(Object.keys(DEFAULT_SPLITS) as PaneId[]).map((id) => (
                <div
                  className="min-w-0"
                  key={id}
                  style={{ flexGrow: DEFAULT_SPLITS[id] }}
                >
                  {bodies[id]}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
