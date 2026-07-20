import type { PullRequestSummary } from "@sphynx/schema/pull-requests";
import { StatusPill, type StatusTone } from "@sphynx/ui/components/status-pill";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@sphynx/ui/components/ui/avatar";
import type { ReactNode } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { BranchChip } from "@/components/layout/branch-chip";
import { DiffStat } from "@/components/pull-request/diff-stat";
import { PullRequestSwitcher } from "@/components/pull-request/pull-request-switcher";
import { plural } from "@/lib/claims";

const STATE_TONES: Record<PullRequestSummary["state"], StatusTone> = {
  open: "positive",
  merged: "neutral",
  closed: "danger",
};

function mergeVerb(pullRequest: PullRequestSummary) {
  if (pullRequest.state === "merged") {
    return "merged";
  }
  if (pullRequest.state === "closed") {
    return "wanted to merge";
  }
  return "wants to merge";
}

interface PullRequestHeaderProps {
  progress?: ReactNode;
  pullRequest: PullRequestSummary;
  refresh?: ReactNode;
  tabs?: ReactNode;
}

export function PullRequestHeader({
  progress,
  pullRequest,
  refresh,
  tabs,
}: PullRequestHeaderProps) {
  const { repository, stats, author } = pullRequest;
  const label = pullRequest.draft ? "draft" : pullRequest.state;
  const tone = pullRequest.draft ? "neutral" : STATE_TONES[pullRequest.state];

  return (
    <header className="flex flex-col border-border border-b">
      <AppHeader
        githubUrl={pullRequest.githubUrl}
        switcher={
          <PullRequestSwitcher
            pullRequestRef={{
              owner: repository.owner,
              repo: repository.name,
              number: pullRequest.number,
            }}
          />
        }
      />
      <div className="flex items-start justify-between gap-4 px-4 pt-3 pb-1">
        <h1 className="text-balance font-heading text-2xl tracking-tight">
          {pullRequest.title}{" "}
          <span className="text-muted-foreground/60">
            #{pullRequest.number}
          </span>
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
            <span className="text-foreground">{author.login}</span>
          </span>
        ) : null}
        <span className="flex flex-wrap items-center gap-1.5">
          {mergeVerb(pullRequest)}{" "}
          <span className="tabular-nums">
            {plural(stats.commits, "commit")} into
          </span>
          <BranchChip name={pullRequest.base.ref} />
          from
          <BranchChip name={pullRequest.head.ref} />
        </span>
        <span className="tabular-nums">
          {plural(stats.changedFiles, "file")}
        </span>
        <DiffStat additions={stats.additions} deletions={stats.deletions} />
        {progress ? <span className="ml-auto">{progress}</span> : null}
      </div>
      {tabs ? (
        <div className="border-border border-t px-2 pt-1 pb-1">{tabs}</div>
      ) : null}
    </header>
  );
}
