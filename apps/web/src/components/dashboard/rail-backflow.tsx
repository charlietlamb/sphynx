import {
  ArrowLineDownIcon,
  GitMergeIcon,
  GitPullRequestIcon,
} from "@phosphor-icons/react";
import type { QueuePull, StageGap } from "@sphynx/schema/review-queue";
import { SignalTip } from "@/components/dashboard/signal-tip";
import { useBackflow } from "@/components/dashboard/use-backflow";
import { shortAge } from "@/lib/age";
import { hasPromotableWork } from "@/lib/attention";

const MAX_ROWS = 10;

interface RailBackflowProps {
  canAct: boolean;
  gap: StageGap;
  now: number;
  onOpenNumber: (number: number) => void;
  openPulls: readonly QueuePull[];
  owner: string;
  repo: string;
}

function SyncControl({
  canAct,
  from,
  merge,
  onOpenNumber,
  open,
  syncPull,
  to,
}: {
  canAct: boolean;
  from: string;
  merge: ReturnType<typeof useBackflow>["merge"];
  onOpenNumber: (number: number) => void;
  open: ReturnType<typeof useBackflow>["open"];
  syncPull: number | null;
  to: string;
}) {
  if (syncPull !== null) {
    return (
      <div className="mt-1 flex items-center gap-1">
        <button
          className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-2 text-[11px] text-primary transition-colors hover:bg-primary/10"
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
          label={
            canAct
              ? `Merge the sync of ${from} into ${to}`
              : "Sign in to merge the sync"
          }
        >
          <button
            aria-label={`Merge #${syncPull}`}
            className="input-bevel-shadow flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
            disabled={!canAct || merge.isPending}
            onClick={() => merge.mutate(syncPull)}
            type="button"
          >
            <GitMergeIcon
              className={
                merge.isPending ? "size-3.5 animate-pulse" : "size-3.5"
              }
              weight="bold"
            />
          </button>
        </SignalTip>
      </div>
    );
  }
  return (
    <SignalTip
      className="mt-1 block"
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
  );
}

/**
 * The backflow gap: hotfixes that landed on the top stage (`gap.from`, e.g. main)
 * and are missing from the bottom (`gap.to`, dev). It renders like a promotion
 * gap — the pulls waiting to come down, then a control to open the sync pull and
 * merge it — but only when there is something to sync; a gap in sync renders
 * nothing, since dev's own "in sync" row already says so. The open/merge control
 * reuses the promote and merge actions, so the sync is an ordinary pull the read
 * model already carries, which is how the open state survives a reload.
 */
export function RailBackflow({
  canAct,
  gap,
  now,
  onOpenNumber,
  openPulls,
  owner,
  repo,
}: RailBackflowProps) {
  const from = gap.from;
  const to = gap.to;
  const { open, merge } = useBackflow({ owner, repo, from, to });
  const existing = openPulls.find(
    (pull) => pull.headRefName === from && pull.baseRefName === to
  );
  // The read model gains the pull a second or two after the "pr opened" webhook
  // lands, so bridge that window with the number the open action returned. A
  // just-merged pull lingers the same way, so drop the merged number from both
  // sources; once the read model catches up `existing` clears on its own.
  const mergedNumber = merge.isSuccess ? (merge.variables ?? null) : null;
  const openNumber = open.data?.number ?? null;
  const existingNumber =
    existing && existing.number !== mergedNumber ? existing.number : null;
  const pendingOpenNumber = openNumber === mergedNumber ? null : openNumber;
  const syncPull = existingNumber ?? pendingOpenNumber;

  if (syncPull === null && !hasPromotableWork(gap)) {
    return null;
  }

  const shown = gap.pulls.slice(0, MAX_ROWS);
  const extra = gap.pulls.length - shown.length;
  return (
    <div className="relative py-0.5 pl-7">
      <span
        aria-hidden
        className="absolute top-0 bottom-0 left-[13px] w-[2px] bg-primary/40"
      />
      {shown.map((pull) => (
        <button
          className="flex h-7 w-full min-w-0 items-center gap-2 rounded-sm text-left transition-colors hover:bg-alpha-4"
          key={pull.number}
          onClick={() => onOpenNumber(pull.number)}
          type="button"
        >
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground/70 tabular-nums">
            #{pull.number}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
            {pull.title}
          </span>
          <span className="shrink-0 text-[11px] text-muted-foreground/60 tabular-nums">
            {pull.mergedAt ? shortAge(pull.mergedAt, now) : ""}
          </span>
        </button>
      ))}
      {extra > 0 ? (
        <p className="py-0.5 text-[11px] text-muted-foreground/70 tabular-nums">
          +{extra} more
        </p>
      ) : null}
      <SyncControl
        canAct={canAct}
        from={from}
        merge={merge}
        onOpenNumber={onOpenNumber}
        open={open}
        syncPull={syncPull}
        to={to}
      />
    </div>
  );
}
