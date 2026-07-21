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
        <>
          <span
            aria-hidden
            className="absolute top-0 left-[14px] h-1/2 w-[10px] rounded-bl-[9px] border-border border-b border-l"
          />
          <Skeleton className="absolute left-[22px] size-[5px] rounded-full" />
        </>
      )}
      <span className={cn("min-w-0 flex-1", !isStage && "pl-2")}>
        <Skeleton className="h-3" style={{ width: nameWidth }} />
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <Skeleton className="h-[3px] w-[17px] rounded-full" />
        <Skeleton className="h-3 w-4" />
      </span>
      <span aria-hidden className="w-[15px] shrink-0" />
    </div>
  );
}
