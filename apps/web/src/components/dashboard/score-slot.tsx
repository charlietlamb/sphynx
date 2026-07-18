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

function scoreStroke(ratio: number) {
  if (ratio >= STRONG_SCORE) {
    return "stroke-addition";
  }
  if (ratio < WEAK_SCORE) {
    return "stroke-deletion";
  }
  return "stroke-amber-500";
}

const ARC_CIRCUMFERENCE = 2 * Math.PI * 6;

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
  const value = latest?.label.split("/")[0];
  return (
    <span className="flex w-8 shrink-0 items-center justify-end">
      {latest ? (
        <SignalTip
          className="flex items-center gap-1"
          label={scoresLabel(scores)}
        >
          <svg
            aria-hidden="true"
            className="size-3.5 -rotate-90"
            viewBox="0 0 16 16"
          >
            <circle
              className="stroke-muted-foreground/20"
              cx="8"
              cy="8"
              fill="none"
              r="6"
              strokeWidth="2.5"
            />
            <circle
              className={scoreStroke(latest.ratio)}
              cx="8"
              cy="8"
              fill="none"
              r="6"
              strokeDasharray={`${latest.ratio * ARC_CIRCUMFERENCE} ${ARC_CIRCUMFERENCE}`}
              strokeLinecap="round"
              strokeWidth="2.5"
            />
          </svg>
          <span
            className={cn(
              "font-semibold text-[12px] tabular-nums leading-none",
              scoreClass(latest.ratio)
            )}
          >
            {value}
          </span>
        </SignalTip>
      ) : null}
    </span>
  );
}
