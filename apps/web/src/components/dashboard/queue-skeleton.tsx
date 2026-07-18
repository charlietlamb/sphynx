import { Skeleton } from "@sphynx/ui/components/ui/skeleton";
import { cn } from "@sphynx/ui/lib/utils";
import { QueueRowSkeleton } from "@/components/dashboard/queue-row-skeleton";

const TITLE_WIDTHS = ["46%", "58%", "34%", "62%", "41%", "52%", "38%"];

function BranchHeaderSkeleton({
  first = true,
  nameWidth,
}: {
  first?: boolean;
  nameWidth: string;
}) {
  return (
    <div
      className={cn(
        "-mx-4 mb-1 flex items-center gap-2 border-border border-b px-[26px] pt-3 pb-2",
        !first && "border-t"
      )}
    >
      <Skeleton className="h-3" style={{ width: nameWidth }} />
      <Skeleton className="h-3 w-6" />
    </div>
  );
}

export function QueueSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-4 pb-3">
      <div className="flex flex-col gap-1">
        <BranchHeaderSkeleton nameWidth="2.5rem" />
        {TITLE_WIDTHS.map((width) => (
          <QueueRowSkeleton key={width} titleWidth={width} />
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <BranchHeaderSkeleton first={false} nameWidth="3.5rem" />
        {TITLE_WIDTHS.slice(0, 3).map((width) => (
          <QueueRowSkeleton key={width} titleWidth={width} />
        ))}
      </div>
    </div>
  );
}
