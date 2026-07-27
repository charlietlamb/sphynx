import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@sphynx/ui/components/ui/resizable";
import type { ReactNode } from "react";
import { ArrangeToggle } from "@/components/dashboard/arrange-toggle";
import { PaneSortable } from "@/components/dashboard/pane-sortable";
import {
  type PaneId,
  usePaneOrder,
} from "@/components/dashboard/use-pane-order";
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

const CARD =
  "flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xs";

const PANE_META: Record<PaneId, { defaultSize: number; minSize: number }> = {
  rail: { defaultSize: 17, minSize: 12 },
  queue: { defaultSize: 53, minSize: 30 },
  dossier: { defaultSize: 30, minSize: 20 },
};

export function DashboardShell({
  dossier,
  githubUrl,
  queue,
  rail,
  railFooter,
  switcher,
}: DashboardShellProps) {
  const { arranging, order, reorder, reset, toggleArranging } = usePaneOrder();

  const handleReset = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("react-resizable-panels:sphynx-dashboard");
    }
    reset();
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const from = order.indexOf(active.id as PaneId);
    const to = order.indexOf(over.id as PaneId);
    if (from !== -1 && to !== -1) {
      reorder(arrayMove(order, from, to));
    }
  };

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
    dossier: <div className="flex h-full min-h-0 flex-col">{dossier}</div>,
  };

  const padFor = (index: number) => {
    if (index === 0) {
      return "p-2.5 pt-[13px] pr-1.5";
    }
    if (index === order.length - 1) {
      return "p-2.5 pt-[13px] pl-1.5";
    }
    return "p-2.5 px-1.5 pt-[13px]";
  };

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
            <AppHeader
              actions={
                <ArrangeToggle
                  arranging={arranging}
                  onReset={handleReset}
                  onToggle={toggleArranging}
                />
              }
              githubUrl={githubUrl}
              switcher={switcher}
            />
          </div>
        </div>
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
          sensors={sensors}
        >
          <SortableContext
            items={order}
            strategy={horizontalListSortingStrategy}
          >
            <ResizablePanelGroup
              autoSaveId="sphynx-dashboard"
              className="min-h-0 flex-1"
              direction="horizontal"
            >
              {order.flatMap((id, index) => {
                const panel = (
                  <ResizablePanel
                    defaultSize={PANE_META[id].defaultSize}
                    id={id}
                    key={id}
                    minSize={PANE_META[id].minSize}
                    order={index}
                  >
                    <div
                      className={`flex h-full min-h-0 flex-col ${padFor(index)}`}
                    >
                      <PaneSortable arranging={arranging} id={id}>
                        {bodies[id]}
                      </PaneSortable>
                    </div>
                  </ResizablePanel>
                );
                if (index === order.length - 1) {
                  return [panel];
                }
                return [
                  panel,
                  <ResizableHandle
                    className="bg-transparent"
                    key={`handle-${id}`}
                  />,
                ];
              })}
            </ResizablePanelGroup>
          </SortableContext>
        </DndContext>
      </div>
    </main>
  );
}
