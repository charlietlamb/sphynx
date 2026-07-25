import { ArrowLineDownIcon, GitPullRequestIcon } from "@phosphor-icons/react";
import type { StageGap } from "@sphynx/schema/review-queue";
import { SignalTip } from "@/components/dashboard/signal-tip";
import { usePromote } from "@/components/dashboard/use-promote";

interface RailPromotionProps {
  canAct: boolean;
  gap: StageGap;
  onOpenNumber: (number: number) => void;
  owner: string;
  repo: string;
}

export function RailPromotion({
  canAct,
  gap,
  onOpenNumber,
  owner,
  repo,
}: RailPromotionProps) {
  const promote = usePromote(owner, repo);
  if (gap.promotionPull !== null) {
    const promotionPull = gap.promotionPull;
    return (
      <button
        className="mt-1 flex h-7 w-full items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-2 text-[11px] text-primary transition-colors hover:bg-primary/10"
        onClick={() => onOpenNumber(promotionPull)}
        type="button"
      >
        <GitPullRequestIcon className="size-3.5 shrink-0" weight="fill" />
        <span className="min-w-0 flex-1 truncate text-left">
          release pr open
        </span>
        <span className="shrink-0 font-mono text-primary/70">
          #{promotionPull}
        </span>
      </button>
    );
  }
  return (
    <>
      <SignalTip
        className="mt-1 block"
        label={
          canAct
            ? `Opens a pull request from ${gap.from} into ${gap.to}`
            : "Sign in to open a release pr"
        }
      >
        <button
          className="input-bevel-shadow flex h-7 w-full items-center gap-1.5 rounded-md border border-border bg-background px-2 text-[11px] transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
          disabled={!canAct || promote.isPending}
          onClick={() => promote.mutate({ from: gap.from, to: gap.to })}
          type="button"
        >
          <ArrowLineDownIcon
            className="size-3.5 shrink-0 text-muted-foreground"
            weight="bold"
          />
          <span className="min-w-0 flex-1 truncate text-left text-foreground">
            {promote.isPending ? "opening release pr…" : "open release pr"}
          </span>
          <span className="shrink-0 font-mono text-muted-foreground/70">
            {gap.from}→{gap.to}
          </span>
        </button>
      </SignalTip>
      {promote.isError ? (
        <p className="mt-1 text-[11px] text-deletion">
          Couldn't open the release pr.
        </p>
      ) : null}
    </>
  );
}
