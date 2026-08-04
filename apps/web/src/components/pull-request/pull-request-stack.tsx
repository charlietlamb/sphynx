import { GitBranchIcon, StackIcon } from "@phosphor-icons/react";
import type { PullRequestRef } from "@sphynx/schema/pull-requests";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@sphynx/ui/components/ui/dropdown-menu";
import { cn } from "@sphynx/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import type { Stack, StackEntry } from "@/components/pull-request/stack";
import { useStack } from "@/components/pull-request/use-stack";

function StackRow({
  entry,
  owner,
  repo,
}: {
  entry: StackEntry;
  owner: string;
  repo: string;
}) {
  return (
    <DropdownMenuItem
      className={cn(
        "flex flex-col items-stretch gap-0.5 py-1.5",
        entry.isCurrent && "bg-muted"
      )}
      render={
        <Link
          params={{ owner, repo, number: entry.number }}
          to="/$owner/$repo/pull/$number"
        />
      }
    >
      <span className="flex items-center gap-2">
        <GitBranchIcon className="size-3.5 shrink-0 text-addition" />
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[13px]",
            entry.isCurrent
              ? "font-medium text-foreground"
              : "text-foreground/90"
          )}
        >
          {entry.title}
        </span>
      </span>
      <span className="flex items-center gap-1.5 pl-[22px] text-[11px] text-muted-foreground/70">
        <span className="font-mono tabular-nums">#{entry.number}</span>
        <span aria-hidden>·</span>
        <span className="min-w-0 truncate font-mono">{entry.headRef}</span>
      </span>
    </DropdownMenuItem>
  );
}

/**
 * The GitHub-style stack navigator: a `position/total` badge in the header that
 * opens a popover of every PR in the stack — tip at the top, base branch at the
 * bottom — with the current PR highlighted, each a link to jump straight there.
 * Only rendered for a PR that is actually part of a stack.
 */
export function PullRequestStack({
  pullRequestRef,
}: {
  pullRequestRef: PullRequestRef;
}) {
  const stack = useStack(pullRequestRef);
  if (!stack) {
    return null;
  }
  return <StackBadge pullRequestRef={pullRequestRef} stack={stack} />;
}

function StackBadge({
  pullRequestRef,
  stack,
}: {
  pullRequestRef: PullRequestRef;
  stack: Stack;
}) {
  const reversed = [...stack.entries].reverse();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 font-medium text-[11px] text-foreground/90 tabular-nums transition-colors hover:bg-muted"
        title={`Part of a stack of ${stack.entries.length}`}
      >
        <StackIcon className="size-3.5 text-muted-foreground" weight="fill" />
        {stack.position}/{stack.entries.length}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80 p-1.5">
        <div className="flex items-center gap-2 px-2 pt-1 pb-2">
          <StackIcon className="size-3.5 text-muted-foreground" weight="fill" />
          <span className="font-medium text-[13px] text-foreground">Stack</span>
          <span className="text-[11px] text-muted-foreground/70 tabular-nums">
            {stack.entries.length} pull requests
          </span>
        </div>
        <div className="flex flex-col">
          {reversed.map((entry) => (
            <StackRow
              entry={entry}
              key={entry.number}
              owner={pullRequestRef.owner}
              repo={pullRequestRef.repo}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 px-2 pt-2 pb-1 text-[11px] text-muted-foreground/70">
          <span className="flex size-3.5 items-center justify-center">
            <span className="size-1.5 rounded-full border border-muted-foreground/50" />
          </span>
          <span className="font-mono">{stack.baseBranch}</span>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
