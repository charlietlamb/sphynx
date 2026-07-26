import { Skeleton } from "@sphynx/ui/components/ui/skeleton";

interface QueueRowSkeletonProps {
  titleWidth: string;
}

const TICK_HEIGHTS = ["h-[6px]", "h-[9px]", "h-[7px]", "h-[10px]"];

export function QueueRowSkeleton({ titleWidth }: QueueRowSkeletonProps) {
  return (
    <div className="-mx-4 flex h-11 w-[calc(100%+2rem)] items-center gap-2.5 border-border/40 border-b pr-[26px] pl-[26px]">
      <Skeleton className="size-5 shrink-0 rounded-full" />
      <Skeleton className="h-3 w-8 shrink-0" />
      <span className="min-w-0 flex-1">
        <Skeleton className="h-3.5" style={{ width: titleWidth }} />
      </span>
      <Skeleton className="size-[5px] shrink-0 rounded-full" />
      <span className="flex shrink-0 items-end gap-px">
        {TICK_HEIGHTS.map((height) => (
          <Skeleton
            className={`w-[3px] rounded-[1px] ${height}`}
            key={height}
          />
        ))}
      </span>
      <Skeleton className="h-3 w-6 shrink-0" />
    </div>
  );
}
