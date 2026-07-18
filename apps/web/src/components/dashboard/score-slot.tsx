import type { QueuePull } from "@sphynx/schema/review-queue";
import { cn } from "@sphynx/ui/lib/utils";
import { SignalTip } from "@/components/dashboard/signal-tip";
import { pullScores, type ScoreSummary } from "@/lib/attention";
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

function scoresLabel(scores: ScoreSummary[]) {
  if (scores.length === 1) {
    const only = scores[0];
    return `Scored ${only?.label} by ${stripBotSuffix(only?.reviewer ?? "")}`;
  }
  return [...scores]
    .reverse()
    .map((score) => `${score.label} ${stripBotSuffix(score.reviewer)}`)
    .join(" · ");
}

export function ScoreSlot({ pull }: { pull: QueuePull }) {
  const scores = pullScores(pull);
  const latest = scores.at(-1);
  return (
    <span className="flex w-8 shrink-0 items-center justify-end">
      {latest ? (
        <SignalTip label={scoresLabel(scores)}>
          <span
            className={cn(
              "font-medium text-[11px] tabular-nums",
              scoreClass(latest.ratio)
            )}
          >
            {latest.label}
          </span>
        </SignalTip>
      ) : null}
    </span>
  );
}
