import { Skeleton } from "@sphynx/ui/components/ui/skeleton";
import { RailBranchSkeleton } from "@/components/dashboard/rail-branch-skeleton";

const NAME_WIDTHS = ["2.5rem", "3rem", "7rem", "6rem"];

export function RailSkeleton() {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="px-2 font-medium text-[11px] text-muted-foreground/60">
        flow
      </p>
      <div className="flex flex-col">
        <RailBranchSkeleton nameWidth={NAME_WIDTHS[0] ?? "3rem"} />
        <div className="flex h-[24.5px] items-center py-0.5 pl-7">
          <Skeleton className="h-2.5 w-24" />
        </div>
        {NAME_WIDTHS.slice(1).map((width) => (
          <RailBranchSkeleton key={width} nameWidth={width} />
        ))}
        <div className="flex h-[26px] items-center gap-2 pr-2 pl-7">
          <Skeleton className="h-3 w-16" />
          <span className="h-px min-w-0 flex-1 bg-border" />
        </div>
      </div>
    </div>
  );
}
