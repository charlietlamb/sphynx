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

const CHIP_CLASS =
  "flex size-[16px] items-center justify-center rounded-[5px] font-medium text-[9px] ring-1 tabular-nums";

function CiChip({ pull }: { pull: QueuePull }) {
  const { failed, pending } = pull.ciCounts;
  if (failed > 0) {
    return (
      <span
        className={`${CHIP_CLASS} bg-deletion/10 text-deletion ring-deletion/30`}
      >
        {failed}
      </span>
    );
  }
  if (pending > 0) {
    return (
      <span className={`${CHIP_CLASS} bg-amber-500/10 ring-amber-500/30`}>
        <span className="size-1.5 animate-pulse rounded-full bg-amber-500" />
      </span>
    );
  }
  return (
    <span
      className={`${CHIP_CLASS} bg-addition/10 text-addition ring-addition/25`}
    >
      ✓
    </span>
  );
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
