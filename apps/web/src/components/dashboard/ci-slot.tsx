import type { QueuePull } from "@sphynx/schema/review-queue";

export function CiSlot({ pull }: { pull: QueuePull }) {
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
        ✕
      </span>
    );
  } else if (pull.ci === "pending") {
    signal = (
      <span
        aria-hidden
        className="relative inline-flex size-1.5"
        title="checks running"
      >
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-500/60" />
        <span className="relative inline-flex size-1.5 rounded-full bg-amber-500" />
      </span>
    );
  }
  return (
    <span className="flex w-4 shrink-0 items-center justify-center">
      {signal}
    </span>
  );
}
