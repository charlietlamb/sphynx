import { Skeleton } from "@sphynx/ui/components/ui/skeleton";
import { RailBranchSkeleton } from "@/components/dashboard/rail-branch-skeleton";

export function RailSkeleton() {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="px-2 font-medium text-[11px] text-muted-foreground/60">
        flow
      </p>
      <div className="flex flex-col">
        <RailBranchSkeleton nameWidth="7rem" />
        <RailBranchSkeleton nameWidth="6rem" />
        <RailBranchSkeleton isStage nameWidth="2.5rem" />
        <div className="relative flex h-6 items-center pl-7">
          <Skeleton className="absolute left-[15px] h-px w-[9px]" />
          <Skeleton className="h-2.5 w-24" />
        </div>
        <RailBranchSkeleton isStage nameWidth="3rem" />
        <div className="relative flex h-[26px] items-center gap-2 pr-2 pl-7">
          <Skeleton className="absolute left-[11px] size-[6px] rounded-[1.5px]" />
          <Skeleton className="h-3 w-16" />
          <span className="h-px min-w-0 flex-1 bg-border" />
        </div>
      </div>
    </div>
  );
}
