import { cn } from "@sphynx/ui/lib/utils";
import { DiffCardSkeleton } from "@/components/pull-request/diff-card-skeleton";
import { FileListSkeleton } from "@/components/pull-request/file-list-skeleton";
import { useSettings } from "@/components/settings/settings-provider";

const CARDS = [
  { id: "a", lines: 10 },
  { id: "b", lines: 5 },
  { id: "c", lines: 8 },
  { id: "d", lines: 4 },
];

export function WorkspaceSkeleton() {
  const { settings } = useSettings();
  return (
    <div className="flex min-h-0 min-w-0 flex-1 gap-2.5 overflow-hidden">
      <div
        className={cn(
          "h-full shrink-0",
          settings.sidebarCollapsed ? "w-10" : "w-[22%] max-w-[24rem]"
        )}
      >
        <FileListSkeleton />
      </div>
      <div className="no-scrollbar flex min-h-0 min-w-0 flex-1 flex-col gap-2.5 overflow-hidden">
        {CARDS.map((card) => (
          <DiffCardSkeleton key={card.id} lines={card.lines} />
        ))}
      </div>
    </div>
  );
}
