import { Skeleton } from "@sphynx/ui/components/ui/skeleton";

interface QueueRowSkeletonProps {
  titleWidth: string;
}

export function QueueRowSkeleton({ titleWidth }: QueueRowSkeletonProps) {
  return (
    <div className="-mx-4 flex h-10 w-[calc(100%+2rem)] items-center gap-2.5 border-transparent border-b px-[26px]">
      <Skeleton className="size-5 shrink-0 rounded-full" />
      <Skeleton className="h-3 w-8 shrink-0" />
      <span className="min-w-0 flex-1">
        <Skeleton className="h-3.5" style={{ width: titleWidth }} />
      </span>
      <span className="flex shrink-0 items-center gap-[3px]">
        <Skeleton className="size-[18px] rounded-[5px]" />
        <Skeleton className="size-[18px] rounded-[5px]" />
      </span>
      <Skeleton className="h-3 w-8 shrink-0" />
      <Skeleton className="h-[9px] w-5 shrink-0" />
      <Skeleton className="h-2.5 w-[19px] shrink-0" />
      <Skeleton className="h-3 w-7 shrink-0" />
    </div>
  );
}
