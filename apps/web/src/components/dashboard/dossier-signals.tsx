import type { QueuePull } from "@sphynx/schema/review-queue";
import { SignalTip } from "@/components/dashboard/signal-tip";
import { plural } from "@/lib/claims";

function CheckSignal({ pull }: { pull: QueuePull }) {
  if (pull.ci === "failure") {
    return (
      <SignalTip
        className="flex items-center gap-1"
        label={
          pull.ciFailures.length > 0
            ? `Failing: ${pull.ciFailures.join(", ")}`
            : "Checks failing"
        }
      >
        <span className="font-medium text-[11px] text-deletion">✕</span>
        {pull.ciFailures.length > 0 ? (
          <span className="text-[11px] text-deletion tabular-nums">
            {pull.ciFailures.length}
          </span>
        ) : null}
      </SignalTip>
    );
  }
  if (pull.ci === "pending") {
    return (
      <SignalTip className="inline-flex size-1.5" label="Checks running">
        <span className="inline-flex size-1.5 animate-pulse rounded-full bg-amber-500" />
      </SignalTip>
    );
  }
  if (pull.ci === "success") {
    return (
      <SignalTip className="inline-flex size-1.5" label="Checks green">
        <span className="inline-flex size-1.5 rounded-full bg-addition" />
      </SignalTip>
    );
  }
  return null;
}

export function DossierSignals({ pull }: { pull: QueuePull }) {
  const total = pull.additions + pull.deletions;
  return (
    <span className="ml-auto flex shrink-0 items-center gap-3">
      <CheckSignal pull={pull} />
      <SignalTip
        className="flex items-center gap-1.5"
        label={`+${pull.additions} −${pull.deletions} across ${plural(pull.changedFiles, "file")}`}
      >
        {total > 0 ? (
          <span className="flex h-[3px] w-7 gap-[1.5px] overflow-hidden rounded-full">
            {pull.additions > 0 ? (
              <span
                className="rounded-full bg-addition"
                style={{ flexGrow: pull.additions }}
              />
            ) : null}
            {pull.deletions > 0 ? (
              <span
                className="rounded-full bg-deletion"
                style={{ flexGrow: pull.deletions }}
              />
            ) : null}
          </span>
        ) : null}
        <span className="text-[11px] text-muted-foreground/70 tabular-nums">
          {plural(pull.changedFiles, "file")}
        </span>
      </SignalTip>
    </span>
  );
}
