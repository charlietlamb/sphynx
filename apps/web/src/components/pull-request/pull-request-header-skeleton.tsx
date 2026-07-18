import { Skeleton } from "@sphynx/ui/components/ui/skeleton";
import { SphynxMark } from "@/components/layout/sphynx-mark";

export function PullRequestHeaderSkeleton() {
  return (
    <header className="flex flex-col gap-2 border-border border-b px-4 pt-3 pb-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <SphynxMark className="size-4" />
          <Skeleton className="h-3 w-44" />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="size-7 rounded-sm" />
        </div>
      </div>
      <div className="flex items-start justify-between gap-4">
        <Skeleton className="h-7 w-2/5" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="size-5 rounded-full" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-3 w-28" />
      </div>
    </header>
  );
}
