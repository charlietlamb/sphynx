import type { PullRequestSummary } from "@sphynx/schema/pull-requests";
import { StatusPill, type StatusTone } from "@sphynx/ui/components/status-pill";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@sphynx/ui/components/ui/avatar";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { UserMenu } from "@/components/auth/user-menu";
import { GithubLink } from "@/components/layout/github-link";
import { SphynxMark } from "@/components/layout/sphynx-mark";
import { DiffStat } from "@/components/pull-request/diff-stat";
import { SettingsDialog } from "@/components/settings/settings-dialog";

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
            {repository.owner}/{repository.name} #{pullRequest.number}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <GithubLink href={pullRequest.githubUrl} />
          <SettingsDialog />
          <UserMenu />
        </div>
      </div>
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
          {pullRequest.base.ref} ← {pullRequest.head.ref}
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
