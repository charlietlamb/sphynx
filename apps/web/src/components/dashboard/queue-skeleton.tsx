import { GitPullRequestIcon } from "@phosphor-icons/react";
import { Skeleton } from "@sphynx/ui/components/ui/skeleton";
import { cn } from "@sphynx/ui/lib/utils";
import { QueueRowSkeleton } from "@/components/dashboard/queue-row-skeleton";
import { SectionHeader } from "@/components/layout/section-header";

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
        "-mx-4 flex h-9 items-center gap-2 border-border border-b px-[26px]",
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
    <div className="flex flex-col px-4 pb-3">
      <SectionHeader
        action={<Skeleton className="h-3 w-4" />}
        className="-mx-4 px-4"
        icon={<GitPullRequestIcon className="size-3" weight="fill" />}
        label="Pull requests"
      />
      <div className="-mx-4 flex shrink-0 items-center gap-2 border-border border-b px-4 py-2">
        <Skeleton className="h-7 min-w-0 flex-1 rounded-md" />
        <Skeleton className="h-7 w-28 shrink-0 rounded-md" />
      </div>
      <div className="flex flex-col">
        <div className="flex flex-col">
          <BranchHeaderSkeleton nameWidth="2.5rem" />
          <div className="flex flex-col">
            {TITLE_WIDTHS.map((width) => (
              <QueueRowSkeleton key={width} titleWidth={width} />
            ))}
          </div>
        </div>
        <div className="flex flex-col">
          <BranchHeaderSkeleton first={false} nameWidth="3.5rem" />
          <div className="flex flex-col">
            {TITLE_WIDTHS.slice(0, 3).map((width) => (
              <QueueRowSkeleton key={width} titleWidth={width} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
