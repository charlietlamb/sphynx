import type { PullRequestRef } from "@sphynx/schema/pull-requests";
import { Skeleton } from "@sphynx/ui/components/ui/skeleton";
import { SwitcherSkeleton } from "@/components/dashboard/switcher-skeleton";
import { AppHeader } from "@/components/layout/app-header";

export function PullRequestHeaderSkeleton({
  pullRequestRef,
}: {
  pullRequestRef: PullRequestRef;
}) {
  const { owner, repo, number } = pullRequestRef;
  return (
    <header className="flex flex-col border-border border-b">
      <AppHeader
        githubUrl={`https://github.com/${owner}/${repo}/pull/${number}`}
        switcher={<SwitcherSkeleton />}
      />
      <div className="flex items-start justify-between gap-4 px-4 pt-3 pb-1">
        <Skeleton className="h-8 w-2/5" />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
        <Skeleton className="h-[22px] w-14 rounded-full" />
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-3 w-28" />
      </div>
      <div className="flex items-center gap-1 border-border border-t px-2 pt-1 pb-1">
        <Skeleton className="h-8 w-12 rounded-md" />
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>
    </header>
  );
}
