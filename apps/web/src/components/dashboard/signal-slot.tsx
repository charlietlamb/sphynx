import type { QueuePull } from "@sphynx/schema/review-queue";
import { cn } from "@sphynx/ui/lib/utils";
import { worstScore } from "@/lib/attention";

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

export function SignalSlot({ pull }: { pull: QueuePull }) {
  const score = worstScore(pull);
  let signal: React.ReactNode = null;
  if (pull.ci === "failure") {
    signal = (
      <span
        className="font-medium text-[11px] text-deletion"
        title={
          pull.ciFailures.length > 0
            ? `failing: ${pull.ciFailures.join(", ")}`
            : "checks failing"
        }
      >
        ✕ ci
      </span>
    );
  } else if (score) {
    signal = (
      <span
        className={cn(
          "font-medium text-[11px] tabular-nums",
          scoreClass(score.ratio)
        )}
        title={`lowest reviewer score ${score.label}`}
      >
        {score.label}
      </span>
    );
  } else if (pull.ci === "pending") {
    signal = (
      <span aria-hidden className="relative inline-flex size-1.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-500/60" />
        <span className="relative inline-flex size-1.5 rounded-full bg-amber-500" />
      </span>
    );
  }
  return (
    <span className="flex w-10 shrink-0 items-center justify-end">
      {signal}
    </span>
  );
}
