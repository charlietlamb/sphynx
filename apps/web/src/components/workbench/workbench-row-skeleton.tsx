import { Skeleton } from "@sphynx/ui/components/ui/skeleton";

interface WorkbenchRowSkeletonProps {
  titleWidth: string;
}

export function WorkbenchRowSkeleton({
  titleWidth,
}: WorkbenchRowSkeletonProps) {
  return (
    <div className="flex h-9 w-full items-center gap-2.5 rounded-md border border-transparent px-2.5">
      <Skeleton className="size-[5px] shrink-0 rounded-[1.5px]" />
      <Skeleton className="size-[18px] shrink-0 rounded-[5px]" />
      <Skeleton className="h-3 w-14 shrink-0" />
      <Skeleton className="h-3 w-16 shrink-0" />
      <Skeleton className="h-3 w-8 shrink-0" />
      <span className="min-w-0 flex-1">
        <Skeleton className="h-3" style={{ width: titleWidth }} />
      </span>
      <Skeleton className="ml-auto h-3 w-7 shrink-0" />
    </div>
  );
}
