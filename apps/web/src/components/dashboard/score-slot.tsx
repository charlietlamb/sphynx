import type { QueuePull } from "@sphynx/schema/review-queue";
import { cn } from "@sphynx/ui/lib/utils";
import { ScoreArc } from "@/components/dashboard/score-arc";
import { SignalTip } from "@/components/dashboard/signal-tip";
import { pullScores, type ScoreSummary } from "@/lib/attention";
import { stripBotSuffix } from "@/lib/claims";
import { scoreClass } from "@/lib/score";

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
          <ScoreArc ratio={latest.ratio} />
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
