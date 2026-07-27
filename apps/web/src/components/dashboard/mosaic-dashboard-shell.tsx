import { DotsSixIcon } from "@phosphor-icons/react";
import { cn } from "@sphynx/ui/lib/utils";
import type { ReactNode } from "react";
import { Mosaic, type MosaicPath, MosaicWindow } from "react-mosaic-component";
import { ArrangeToggle } from "@/components/dashboard/arrange-toggle";
import { useIsClient } from "@/components/dashboard/use-is-client";
import {
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

type LayoutTree = ReturnType<typeof useMosaicLayout>["layout"];

/**
 * The pre-hydration fallback (before the client-only Mosaic mounts) renders the
 * panes as a plain flex row so the saved arrangement's proportions show instantly
 * instead of a default-split flash. It reads the top-level row split when the
 * layout is a simple row (the common case) and falls back to equal shares.
 */
function fallbackPanes(layout: LayoutTree): { id: PaneId; share: number }[] {
  if (
    typeof layout === "object" &&
    layout.type === "split" &&
    layout.direction === "row" &&
    layout.children.every((c) => typeof c === "string")
  ) {
    const ids = layout.children as PaneId[];
    const splits = layout.splitPercentages ?? ids.map(() => 100 / ids.length);
    return ids.map((id, index) => ({ id, share: splits[index] ?? 1 }));
  }
  return (["rail", "queue", "dossier"] as PaneId[]).map((id) => ({
    id,
    share: 1,
  }));
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
        <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-3">
          {rail}
        </div>
        {railFooter}
      </div>
    ),
    queue: (
      <section className="no-scrollbar flex h-full min-h-0 flex-col overflow-y-auto overflow-x-hidden rounded-lg border border-border bg-card shadow-xs">
        {queue}
      </section>
    ),
    dossier,
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
            "absolute inset-0",
            arranging
              ? "cursor-grab active:cursor-grabbing"
              : "pointer-events-none"
          )}
          title={arranging ? `Drag to rearrange ${PANE_TITLES[id]}` : undefined}
        />
      )}
      title={PANE_TITLES[id]}
    >
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
            <div className="absolute inset-0 flex">
              {fallbackPanes(layout).map(({ id, share }) => (
                <div className="min-w-0" key={id} style={{ flexGrow: share }}>
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
