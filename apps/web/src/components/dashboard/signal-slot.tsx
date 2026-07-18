import type { QueuePull } from "@sphynx/schema/review-queue";
import { worstScore } from "@/lib/attention";

const WEAK_SCORE = 0.5;

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
  } else if (score && score.ratio < 1) {
    signal = (
      <span
        className={
          score.ratio < WEAK_SCORE
            ? "font-medium text-[11px] text-deletion tabular-nums"
            : "font-medium text-[11px] text-amber-500 tabular-nums"
        }
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
