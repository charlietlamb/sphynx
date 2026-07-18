import { Skeleton } from "@sphynx/ui/components/ui/skeleton";

interface RailBranchSkeletonProps {
  nameWidth: string;
}

export function RailBranchSkeleton({ nameWidth }: RailBranchSkeletonProps) {
  return (
    <div className="relative flex h-7 w-full items-center gap-2 pr-2 pl-7">
      <Skeleton className="absolute left-[22px] size-[5px] rounded-full" />
      <span className="min-w-0 flex-1">
        <Skeleton className="h-3" style={{ width: nameWidth }} />
      </span>
      <Skeleton className="h-3 w-5 shrink-0" />
    </div>
  );
}
