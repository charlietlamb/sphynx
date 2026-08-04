import {
  ArrowLineDownIcon,
  GitMergeIcon,
  GitPullRequestIcon,
} from "@phosphor-icons/react";
import type { QueuePull } from "@sphynx/schema/review-queue";
import { SignalTip } from "@/components/dashboard/signal-tip";
import { useBackflow } from "@/components/dashboard/use-backflow";

interface RailBackflowProps {
  canAct: boolean;
  from: string;
  onOpenNumber: (number: number) => void;
  openPulls: readonly QueuePull[];
  owner: string;
  repo: string;
  to: string;
}

/**
 * The mirror of the promotion rail's release button, running the other way: a
 * hotfix that landed on the top stage (`from`, e.g. main) needs to flow back
 * down into `to` (dev). Opening the sync pull and merging it reuse the same
 * write actions as an upward promotion, so the backmerge is an ordinary pull the
 * read model already carries — which is how the open state survives a reload.
 */
export function RailBackflow({
  canAct,
  from,
  onOpenNumber,
  openPulls,
  owner,
  repo,
  to,
}: RailBackflowProps) {
  const { open, merge } = useBackflow({ owner, repo, from, to });
  const existing = openPulls.find(
    (pull) => pull.headRefName === from && pull.baseRefName === to
  );
  // The read model gains the pull a second or two after the "pr opened" webhook
  // lands, so bridge that window with the number the open action returned.
  const syncPull = existing?.number ?? open.data?.number ?? null;

  if (syncPull !== null) {
    return (
      <div className="mt-1 flex flex-col gap-1">
        <button
          className="flex h-7 w-full items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-2 text-[11px] text-primary transition-colors hover:bg-primary/10"
          onClick={() => onOpenNumber(syncPull)}
          type="button"
        >
          <GitPullRequestIcon className="size-3.5 shrink-0" weight="fill" />
          <span className="min-w-0 flex-1 truncate text-left">
            sync pr open
          </span>
          <span className="shrink-0 font-mono text-primary/70">
            #{syncPull}
          </span>
        </button>
        <SignalTip
          className="block"
          label={
            canAct
              ? `Merge the sync of ${from} into ${to}`
              : "Sign in to merge the sync"
          }
        >
          <button
            className="input-bevel-shadow flex h-7 w-full items-center gap-1.5 rounded-md border border-border bg-background px-2 text-[11px] transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
            disabled={!canAct || merge.isPending}
            onClick={() => merge.mutate(syncPull)}
            type="button"
          >
            <GitMergeIcon
              className="size-3.5 shrink-0 text-muted-foreground"
              weight="bold"
            />
            <span className="min-w-0 flex-1 truncate text-left text-foreground">
              {merge.isPending ? "merging…" : `merge #${syncPull}`}
            </span>
          </button>
        </SignalTip>
      </div>
    );
  }

  return (
    <div className="mt-1">
      <SignalTip
        className="block"
        label={
          canAct
            ? `Opens a pull request from ${from} into ${to}`
            : "Sign in to sync branches"
        }
      >
        <button
          className="input-bevel-shadow flex h-7 w-full items-center gap-1.5 rounded-md border border-border bg-background px-2 text-[11px] transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
          disabled={!canAct || open.isPending}
          onClick={() => open.mutate()}
          type="button"
        >
          <ArrowLineDownIcon
            className="size-3.5 shrink-0 text-muted-foreground"
            weight="bold"
          />
          <span className="min-w-0 flex-1 truncate text-left text-foreground">
            {open.isPending ? "opening sync pr…" : "sync down"}
          </span>
          <span className="shrink-0 font-mono text-muted-foreground/70">
            {from}→{to}
          </span>
        </button>
      </SignalTip>
    </div>
  );
}
