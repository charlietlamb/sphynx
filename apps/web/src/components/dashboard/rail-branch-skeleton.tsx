import { Skeleton } from "@sphynx/ui/components/ui/skeleton";

interface RailBranchSkeletonProps {
  nameWidth: string;
}

export function RailBranchSkeleton({ nameWidth }: RailBranchSkeletonProps) {
  return (
    <div className="flex w-full items-center gap-2.5 px-2 py-1.5">
      <Skeleton className="size-[7px] shrink-0 rounded-full" />
      <span className="min-w-0 flex-1">
        <Skeleton className="h-3" style={{ width: nameWidth }} />
      </span>
      <Skeleton className="h-3 w-5 shrink-0" />
    </div>
  );
}
