import { GitBranchIcon } from "@phosphor-icons/react";
import { Skeleton } from "@sphynx/ui/components/ui/skeleton";
import { RailBranchSkeleton } from "@/components/dashboard/rail-branch-skeleton";
import { SectionHeader } from "@/components/layout/section-header";

function GapQueueSkeleton() {
  return (
    <div className="relative flex flex-col py-0.5 pl-7">
      <span
        aria-hidden
        className="absolute top-0 bottom-0 left-[13px] w-[2px] bg-border"
      />
      <div className="flex items-center gap-1.5 py-0.5">
        <Skeleton className="size-3.5 shrink-0 rounded-full" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="flex h-6 items-center gap-2">
        <Skeleton className="h-2.5 w-6 shrink-0" />
        <Skeleton className="h-2.5 w-28" />
      </div>
      <Skeleton className="mt-1 h-7 w-full rounded-md" />
    </div>
  );
}

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
        <GapQueueSkeleton />
        <RailBranchSkeleton isStage nameWidth="3rem" />
      </div>
    </div>
  );
}
