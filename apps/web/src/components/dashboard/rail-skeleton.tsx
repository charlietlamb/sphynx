import { Skeleton } from "@sphynx/ui/components/ui/skeleton";
import { RailBranchSkeleton } from "@/components/dashboard/rail-branch-skeleton";

const NAME_WIDTHS = ["2.5rem", "3rem", "7rem", "6rem"];

export function RailSkeleton() {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="px-2 font-medium text-[10px] text-muted-foreground/60 uppercase tracking-[0.12em]">
        Flow
      </p>
      <div className="flex flex-col">
        <RailBranchSkeleton nameWidth={NAME_WIDTHS[0] ?? "3rem"} />
        <div className="ml-[10px] border-border border-l py-1 pl-3">
          <Skeleton className="h-2.5 w-24" />
        </div>
        {NAME_WIDTHS.slice(1).map((width) => (
          <RailBranchSkeleton key={width} nameWidth={width} />
        ))}
      </div>
    </div>
  );
}
