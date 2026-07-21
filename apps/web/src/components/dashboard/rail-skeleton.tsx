import { GitBranchIcon } from "@phosphor-icons/react";
import { Skeleton } from "@sphynx/ui/components/ui/skeleton";
import { RailBranchSkeleton } from "@/components/dashboard/rail-branch-skeleton";
import { SectionHeader } from "@/components/layout/section-header";

export function RailSkeleton() {
  return (
    <div className="flex flex-col">
      <SectionHeader
        className="-mx-3 mb-3 px-3"
        icon={<GitBranchIcon className="size-3" weight="fill" />}
        label="Flow"
      />
      <div className="relative flex flex-col">
        <span
          aria-hidden
          className="absolute top-1 bottom-[13px] left-[13px] w-[2px] rounded-full bg-gradient-to-b from-border via-muted-foreground/30 to-muted-foreground/30"
        />
        <RailBranchSkeleton nameWidth="7rem" />
        <RailBranchSkeleton nameWidth="6rem" />
        <RailBranchSkeleton isStage nameWidth="2.5rem" />
        <div className="relative flex h-6 items-center pl-7">
          <Skeleton className="absolute left-[14px] h-px w-[10px]" />
          <Skeleton className="h-2.5 w-24" />
        </div>
        <RailBranchSkeleton isStage nameWidth="3rem" />
        <div className="relative flex h-[26px] items-center gap-2 pr-2 pl-7">
          <Skeleton className="absolute left-[10.5px] size-[7px] rounded-full" />
          <Skeleton className="h-3 w-16" />
          <span className="h-px min-w-0 flex-1 bg-border" />
        </div>
      </div>
    </div>
  );
}
