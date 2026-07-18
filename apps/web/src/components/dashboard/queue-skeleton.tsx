import { Skeleton } from "@sphynx/ui/components/ui/skeleton";
import { QueueRowSkeleton } from "@/components/dashboard/queue-row-skeleton";

const TITLE_WIDTHS = ["46%", "58%", "34%", "62%", "41%", "52%", "38%"];

function BranchHeaderSkeleton({ nameWidth }: { nameWidth: string }) {
  return (
    <div className="flex items-center gap-2 px-2.5 pt-1 pb-0.5">
      <Skeleton className="size-[7px] shrink-0 rounded-full" />
      <Skeleton className="h-3" style={{ width: nameWidth }} />
      <Skeleton className="h-3 w-6" />
    </div>
  );
}

export function QueueSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <BranchHeaderSkeleton nameWidth="2.5rem" />
        {TITLE_WIDTHS.map((width) => (
          <QueueRowSkeleton key={width} titleWidth={width} />
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <BranchHeaderSkeleton nameWidth="3.5rem" />
        {TITLE_WIDTHS.slice(0, 3).map((width) => (
          <QueueRowSkeleton key={width} titleWidth={width} />
        ))}
      </div>
    </div>
  );
}
