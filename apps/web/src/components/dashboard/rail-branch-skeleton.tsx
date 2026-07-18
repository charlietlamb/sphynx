import { Skeleton } from "@sphynx/ui/components/ui/skeleton";
import { cn } from "@sphynx/ui/lib/utils";

interface RailBranchSkeletonProps {
  isStage?: boolean;
  nameWidth: string;
}

export function RailBranchSkeleton({
  isStage = false,
  nameWidth,
}: RailBranchSkeletonProps) {
  return (
    <div
      className={cn(
        "relative flex w-full items-center gap-2 pr-2 pl-7",
        isStage ? "h-8" : "h-7"
      )}
    >
      {isStage ? (
        <Skeleton className="absolute left-[9.5px] size-[9px] rounded-full" />
      ) : (
        <Skeleton className="absolute left-[24px] size-[5px] rounded-full" />
      )}
      <span className={cn("min-w-0 flex-1", !isStage && "pl-3")}>
        <Skeleton className="h-3" style={{ width: nameWidth }} />
      </span>
      <Skeleton className="h-[3px] w-6 rounded-full" />
      <Skeleton className="h-3 w-4" />
    </div>
  );
}
