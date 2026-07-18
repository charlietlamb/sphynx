import type { QueuePull } from "@sphynx/schema/review-queue";
import { cn } from "@sphynx/ui/lib/utils";
import { worstScore } from "@/lib/attention";

const LOW_SCORE = 0.5;
const HIGH_SCORE = 0.9;

export function ScoreChip({ pull }: { pull: QueuePull }) {
  const score = worstScore(pull);
  if (!score) {
    return <span className="w-8 shrink-0" />;
  }
  return (
    <span
      className={cn(
        "w-8 shrink-0 text-right font-mono text-[11px] tabular-nums",
        score.ratio < LOW_SCORE && "text-deletion",
        score.ratio >= HIGH_SCORE && "text-addition",
        score.ratio >= LOW_SCORE &&
          score.ratio < HIGH_SCORE &&
          "text-muted-foreground"
      )}
      title={`lowest reviewer score ${score.label}`}
    >
      {score.label}
    </span>
  );
}
