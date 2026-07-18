import { Skeleton } from "@sphynx/ui/components/ui/skeleton";
import { RailBranchSkeleton } from "@/components/dashboard/rail-branch-skeleton";

export function RailSkeleton() {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="-mx-3 mb-2 flex items-center border-border border-b bg-background px-3 pt-3 pb-2">
        <p className="font-medium text-[11px] text-muted-foreground/60">flow</p>
      </div>
      <div className="relative flex flex-col">
        <span
          aria-hidden
          className="absolute top-1 bottom-[26px] left-[13px] w-[2px] rounded-full bg-gradient-to-b from-border via-muted-foreground/30 to-muted-foreground/30"
        />
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
