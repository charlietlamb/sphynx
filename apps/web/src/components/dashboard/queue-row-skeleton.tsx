import { Skeleton } from "@sphynx/ui/components/ui/skeleton";

interface QueueRowSkeletonProps {
  titleWidth: string;
}

export function QueueRowSkeleton({ titleWidth }: QueueRowSkeletonProps) {
  return (
    <div className="flex h-10 w-full items-center gap-2.5 px-2.5">
      <Skeleton className="size-5 shrink-0 rounded-full" />
      <Skeleton className="h-3 w-10 shrink-0" />
      <span className="min-w-0 flex-1">
        <Skeleton className="h-3.5" style={{ width: titleWidth }} />
      </span>
      <Skeleton className="size-[18px] shrink-0 rounded-full" />
      <Skeleton className="h-3 w-10 shrink-0" />
      <Skeleton className="h-[9px] w-5 shrink-0" />
      <Skeleton className="h-3 w-7 shrink-0" />
    </div>
  );
}
