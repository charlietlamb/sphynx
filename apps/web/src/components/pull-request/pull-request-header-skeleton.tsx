import type { PullRequestRef } from "@sphynx/schema/pull-requests";
import { Skeleton } from "@sphynx/ui/components/ui/skeleton";
import { Link } from "@tanstack/react-router";
import { UserMenu } from "@/components/auth/user-menu";
import { GithubLink } from "@/components/layout/github-link";
import { SphynxMark } from "@/components/layout/sphynx-mark";
import { SettingsDialog } from "@/components/settings/settings-dialog";

export function PullRequestHeaderSkeleton({
  pullRequestRef,
}: {
  pullRequestRef: PullRequestRef;
}) {
  const { owner, repo, number } = pullRequestRef;
  return (
    <header className="flex flex-col border-border border-b">
      <div className="flex items-center justify-between gap-2 border-border border-b px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            aria-label="Sphynx home"
            className="shrink-0 transition-opacity hover:opacity-70"
            to="/"
          >
            <SphynxMark className="size-4" />
          </Link>
          <p className="truncate font-mono text-muted-foreground text-xs">
            {owner}/{repo} #{number}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <GithubLink
            href={`https://github.com/${owner}/${repo}/pull/${number}`}
          />
          <SettingsDialog />
          <UserMenu />
        </div>
      </div>
      <div className="flex items-start justify-between gap-4 border-border border-b px-4 py-3">
        <Skeleton className="h-8 w-2/5" />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="size-5 rounded-full" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-3 w-28" />
      </div>
    </header>
  );
}
