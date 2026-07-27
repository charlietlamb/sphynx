import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@sphynx/ui/lib/utils";
import type { CSSProperties, ReactNode } from "react";
import type { PaneId } from "@/components/dashboard/use-pane-order";

interface PaneSortableProps {
  arranging: boolean;
  children: ReactNode;
  id: PaneId;
}

/**
 * A single pane as a dnd-kit sortable item. In arrange mode the whole card is the
 * drag handle (listeners on the root) and gains a primary ring that brightens +
 * a transparent primary wash on hover — the affordance carried over from the
 * react-mosaic version, now plain Tailwind with no library CSS. Outside arrange
 * mode it is inert, so the resting dashboard has zero drag overhead.
 */
export function PaneSortable({ arranging, children, id }: PaneSortableProps) {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id, disabled: !arranging });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      className={cn(
        "group/pane relative flex h-full min-h-0 flex-col",
        arranging && "cursor-grab active:cursor-grabbing",
        isDragging && "z-20 opacity-60"
      )}
      ref={setNodeRef}
      style={style}
      {...(arranging ? { ...attributes, ...listeners } : {})}
    >
      {children}
      {arranging ? (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 rounded-lg ring-1 ring-primary/40 transition-[box-shadow,background-color] duration-200",
            "group-hover/pane:bg-primary/[0.06] group-hover/pane:ring-2 group-hover/pane:ring-primary"
          )}
        />
      ) : null}
    </div>
  );
}
