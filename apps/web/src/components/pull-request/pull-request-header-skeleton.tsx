import type { PullRequestRef } from "@sphynx/schema/pull-requests";
import { Skeleton } from "@sphynx/ui/components/ui/skeleton";
import { PullRequestHeaderChrome } from "@/components/pull-request/pull-request-header-chrome";

export function PullRequestHeaderSkeleton({
  pullRequestRef,
}: {
  pullRequestRef: PullRequestRef;
}) {
  const { owner, repo, number } = pullRequestRef;
  return (
    <header className="flex flex-col border-border border-b">
      <PullRequestHeaderChrome
        githubUrl={`https://github.com/${owner}/${repo}/pull/${number}`}
        label={`${owner}/${repo} #${number}`}
      />
      <div className="flex items-start justify-between gap-4 border-border border-b px-4 py-3">
        <Skeleton className="h-8 w-2/5" />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
        <Skeleton className="h-[22px] w-14 rounded-full" />
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-3 w-28" />
      </div>
    </header>
  );
}
