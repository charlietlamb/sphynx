import { Kbd } from "@sphynx/ui/components/ui/kbd";
import { ScrollArea } from "@sphynx/ui/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@sphynx/ui/components/ui/sheet";
import { isTypingTarget } from "@sphynx/ui/lib/typing-target";
import { useEffect, useRef, useState } from "react";
import {
  filterWorkbenchEvents,
  type MergedWorkbenchEvent,
  type WorkbenchFilter,
} from "@/components/workbench/workbench-copy";
import { WorkbenchFilters } from "@/components/workbench/workbench-filters";
import { WorkbenchRow } from "@/components/workbench/workbench-row";
import { WorkbenchRowSkeleton } from "@/components/workbench/workbench-row-skeleton";

const SKELETON_WIDTHS = [
  "62%",
  "38%",
  "51%",
  "44%",
  "70%",
  "33%",
  "57%",
  "41%",
];

interface WorkbenchSheetProps {
  events: readonly MergedWorkbenchEvent[];
  isError: boolean;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onRefetch: () => void;
  open: boolean;
  owner: string;
  repo: string;
  viewer: string | null;
}

export function WorkbenchSheet({
  events,
  isError,
  isPending,
  onOpenChange,
  onRefetch,
  open,
  owner,
  repo,
  viewer,
}: WorkbenchSheetProps) {
  const [filter, setFilter] = useState<WorkbenchFilter>("all");
  const [search, setSearch] = useState("");
  const now = Date.now();
  const liveOpenChange = useRef(onOpenChange);
  useEffect(() => {
    liveOpenChange.current = onOpenChange;
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || isTypingTarget(event.target)) {
        return;
      }
      if (event.key === "w") {
        event.preventDefault();
        liveOpenChange.current(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const filtered = filterWorkbenchEvents(events, filter, search, viewer);

  let body: React.ReactNode;
  if (isPending) {
    body = SKELETON_WIDTHS.map((width) => (
      <WorkbenchRowSkeleton key={width} titleWidth={width} />
    ));
  } else if (isError) {
    body = (
      <p className="px-2.5 py-6 text-muted-foreground text-sm">
        Couldn't load repo events.{" "}
        <button
          className="text-primary underline-offset-2 hover:underline"
          onClick={onRefetch}
          type="button"
        >
          Retry
        </button>
      </p>
    );
  } else if (events.length === 0) {
    body = (
      <p className="px-2.5 py-6 text-muted-foreground text-sm">
        Nothing yet. Activity in {owner}/{repo} will appear here.
      </p>
    );
  } else if (filtered.length === 0) {
    body = (
      <p className="px-2.5 py-6 text-muted-foreground text-sm">
        No events match.
      </p>
    );
  } else {
    body = filtered.map((event) => (
      <WorkbenchRow
        event={event}
        key={event.id}
        now={now}
        owner={owner}
        repo={repo}
      />
    ));
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent
        className="flex flex-col gap-0 border-border bg-background p-0 [transition-timing-function:cubic-bezier(.25,.1,.25,1)] data-[side=bottom]:h-[480px]"
        showCloseButton={false}
        side="bottom"
      >
        <SheetTitle className="sr-only">Repo workbench</SheetTitle>
        <div className="flex h-12 shrink-0 items-center gap-4 border-border border-b px-4">
          <WorkbenchFilters
            filter={filter}
            onFilter={setFilter}
            onSearch={setSearch}
            search={search}
          />
          <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground/60">
            <Kbd>esc</Kbd> close
          </span>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-px px-3 py-2">{body}</div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
