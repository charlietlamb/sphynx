import type { QueuePull } from "@sphynx/schema/review-queue";
import { cn } from "@sphynx/ui/lib/utils";
import { SignalTip } from "@/components/dashboard/signal-tip";
import { worstScore } from "@/lib/attention";
import { stripBotSuffix } from "@/lib/claims";

const WEAK_SCORE = 0.5;
const STRONG_SCORE = 0.8;

function scoreClass(ratio: number) {
  if (ratio >= STRONG_SCORE) {
    return "text-addition";
  }
  if (ratio < WEAK_SCORE) {
    return "text-deletion";
  }
  return "text-amber-500";
}

export function ScoreSlot({ pull }: { pull: QueuePull }) {
  const score = worstScore(pull);
  return (
    <span className="flex w-8 shrink-0 items-center justify-end">
      {score ? (
        <SignalTip
          label={`Scored ${score.label} by ${stripBotSuffix(score.reviewer)}`}
        >
          <span
            className={cn(
              "font-medium text-[11px] tabular-nums",
              scoreClass(score.ratio)
            )}
          >
            {score.label}
          </span>
        </SignalTip>
      ) : null}
    </span>
  );
}
