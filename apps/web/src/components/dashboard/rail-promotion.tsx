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
        className="flex h-6 items-center gap-1 text-[11px] text-primary underline-offset-2 transition-colors hover:underline"
        onClick={() => onOpenNumber(promotionPull)}
        type="button"
      >
        promotion <span className="font-mono">#{promotionPull}</span> open
      </button>
    );
  }
  return (
    <>
      <SignalTip
        label={
          canAct
            ? `Opens a pull request from ${gap.from} into ${gap.to}`
            : "Sign in to open a release pr"
        }
      >
        <button
          className="flex h-6 items-center gap-1 text-[11px] text-primary underline-offset-2 transition-colors hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground/50 disabled:no-underline"
          disabled={!canAct || promote.isPending}
          onClick={() => promote.mutate({ from: gap.from, to: gap.to })}
          type="button"
        >
          {promote.isPending
            ? "opening release pr…"
            : `open release pr ${gap.from} → ${gap.to}`}
        </button>
      </SignalTip>
      {promote.isError ? (
        <p className="py-0.5 text-[11px] text-deletion">
          Couldn't open the release pr.
        </p>
      ) : null}
    </>
  );
}
