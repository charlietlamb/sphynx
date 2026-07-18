import type { PullRequestSummary } from "@sphynx/schema/pull-requests";
import { StatusPill, type StatusTone } from "@sphynx/ui/components/status-pill";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@sphynx/ui/components/ui/avatar";
import type { ReactNode } from "react";
import { DiffStat } from "@/components/pull-request/diff-stat";
import { PullRequestHeaderChrome } from "@/components/pull-request/pull-request-header-chrome";

const STATE_TONES: Record<PullRequestSummary["state"], StatusTone> = {
  open: "positive",
  merged: "neutral",
  closed: "danger",
};

interface PullRequestHeaderProps {
  progress?: ReactNode;
  pullRequest: PullRequestSummary;
  refresh?: ReactNode;
}

export function PullRequestHeader({
  progress,
  pullRequest,
  refresh,
}: PullRequestHeaderProps) {
  const { repository, stats, author } = pullRequest;
  const label = pullRequest.draft ? "draft" : pullRequest.state;
  const tone = pullRequest.draft ? "neutral" : STATE_TONES[pullRequest.state];

  return (
    <header className="flex flex-col border-border border-b">
      <PullRequestHeaderChrome
        githubUrl={pullRequest.githubUrl}
        label={`${repository.owner}/${repository.name} #${pullRequest.number}`}
      />
      <div className="flex items-start justify-between gap-4 border-border border-b px-4 py-3">
        <h1 className="text-balance font-heading text-2xl tracking-tight">
          {pullRequest.title}
        </h1>
        {refresh ? (
          <div className="flex shrink-0 items-center gap-2">{refresh}</div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 text-muted-foreground text-sm">
        <StatusPill label={label} tone={tone} />
        {author ? (
          <span className="flex items-center gap-1.5">
            <Avatar size="sm">
              <AvatarImage alt={author.login} src={author.avatarUrl} />
              <AvatarFallback>{author.login[0]}</AvatarFallback>
            </Avatar>
            {author.login}
          </span>
        ) : null}
        <span className="font-mono text-xs">
          {pullRequest.head.ref} → {pullRequest.base.ref}
        </span>
        <span className="tabular-nums">
          {stats.commits} commits · {stats.changedFiles} files
        </span>
        <DiffStat additions={stats.additions} deletions={stats.deletions} />
        {progress ? <span className="ml-auto">{progress}</span> : null}
      </div>
    </header>
  );
}
