import type { QueuePull } from "@sphynx/schema/review-queue";
import { SignalTip } from "@/components/dashboard/signal-tip";

export function CiSlot({ pull }: { pull: QueuePull }) {
  let signal: React.ReactNode = null;
  if (pull.ci === "failure") {
    signal = (
      <SignalTip
        label={
          pull.ciFailures.length > 0
            ? `Failing: ${pull.ciFailures.map((check) => check.name).join(", ")}`
            : "Checks failing"
        }
      >
        <span className="font-medium text-[11px] text-deletion">✕</span>
      </SignalTip>
    );
  } else if (pull.ci === "pending") {
    signal = (
      <SignalTip className="inline-flex size-1.5" label="Checks running">
        <span className="inline-flex size-1.5 animate-pulse rounded-full bg-amber-500" />
      </SignalTip>
    );
  }
  return (
    <span className="flex w-4 shrink-0 items-center justify-center">
      {signal}
    </span>
  );
}
