import { GitPullRequestIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
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
    <div className="flex min-h-full flex-col px-4 pb-2">
      <div className="-mx-4 flex h-11 shrink-0 items-center gap-3 border-border border-b px-4">
        <span className="flex shrink-0 items-center gap-2.5">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground [&_svg]:size-3">
            <GitPullRequestIcon weight="fill" />
          </span>
          <p className="font-heading font-medium text-foreground text-sm tracking-tight">
            Pull requests
          </p>
          <Skeleton className="h-3 w-3" />
        </span>
        <div className="flex h-8 min-w-0 flex-1 items-center gap-2 pr-1 pl-3">
          <MagnifyingGlassIcon className="size-4 shrink-0 text-muted-foreground/40" />
          <Skeleton className="h-3 w-24" />
        </div>
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
