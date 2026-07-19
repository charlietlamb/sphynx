import type { QueuePull } from "@sphynx/schema/review-queue";
import { SignalTip } from "@/components/dashboard/signal-tip";
import { plural } from "@/lib/claims";

function ciLabel(pull: QueuePull) {
  const { failed, passed, pending } = pull.ciCounts;
  const parts: string[] = [];
  if (failed > 0) {
    const names = pull.ciFailures.map((check) => check.name).join(", ");
    parts.push(names ? `${failed} failing: ${names}` : `${failed} failing`);
  }
  if (pending > 0) {
    parts.push(`${pending} running`);
  }
  if (passed > 0) {
    parts.push(`${passed} passed`);
  }
  return parts.length > 0 ? parts.join(" · ") : plural(0, "check");
}

function CiChip({ pull }: { pull: QueuePull }) {
  const { failed, pending } = pull.ciCounts;
  if (failed > 0) {
    return (
      <span className="flex items-baseline gap-[3px] font-medium text-[11px] text-deletion tabular-nums">
        <span className="text-[10px]">✕</span>
        {failed}
      </span>
    );
  }
  if (pending > 0) {
    return (
      <span className="size-1.5 animate-pulse rounded-full bg-amber-500" />
    );
  }
  return <span className="font-medium text-[11px] text-addition/60">✓</span>;
}

export function CiBar({ pull }: { pull: QueuePull }) {
  const { failed, passed, pending } = pull.ciCounts;
  if (failed + passed + pending === 0) {
    return null;
  }
  return (
    <SignalTip className="inline-flex" label={ciLabel(pull)}>
      <CiChip pull={pull} />
    </SignalTip>
  );
}
