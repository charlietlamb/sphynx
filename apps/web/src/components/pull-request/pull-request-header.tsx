import type { PullRequestSummary } from "@sphynx/schema/pull-requests";
import { StatusPill, type StatusTone } from "@sphynx/ui/components/status-pill";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@sphynx/ui/components/ui/avatar";
import { buttonVariants } from "@sphynx/ui/components/ui/button";
import { cn } from "@sphynx/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { UserMenu } from "@/components/auth/user-menu";
import { GithubIcon } from "@/components/icons/github-icon";
import { SphynxMark } from "@/components/layout/sphynx-mark";
import { DiffStat } from "@/components/pull-request/diff-stat";
import { SettingsDialog } from "@/components/settings/settings-dialog";

const STATE_TONES: Record<PullRequestSummary["state"], StatusTone> = {
  open: "positive",
  merged: "neutral",
  closed: "danger",
};

interface PullRequestHeaderProps {
  pullRequest: PullRequestSummary;
  refresh?: ReactNode;
}

export function PullRequestHeader({
  pullRequest,
  refresh,
}: PullRequestHeaderProps) {
  const { repository, stats, author } = pullRequest;
  const label = pullRequest.draft ? "draft" : pullRequest.state;
  const tone = pullRequest.draft ? "neutral" : STATE_TONES[pullRequest.state];

  return (
    <header className="flex flex-col gap-2 border-border border-b pb-4">
      <div className="flex items-center justify-between gap-2">
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
          <SettingsDialog />
          <UserMenu />
        </div>
      </div>
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-balance font-heading text-2xl tracking-tight">
          {pullRequest.title}
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          {refresh}
          <a
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            href={pullRequest.githubUrl}
            rel="noreferrer"
            target="_blank"
          >
            <GithubIcon />
            View on GitHub
          </a>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-muted-foreground text-sm">
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
      </div>
    </header>
  );
}
