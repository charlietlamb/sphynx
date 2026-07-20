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

function GlowDot({ pull }: { pull: QueuePull }) {
  const { failed, pending } = pull.ciCounts;
  if (failed > 0) {
    return (
      <span className="size-[5px] rounded-full bg-deletion transition-shadow group-hover:animate-pulse group-hover:shadow-[0_0_7px_1px_var(--deletion)]" />
    );
  }
  if (pending > 0) {
    return (
      <span className="size-[5px] animate-pulse rounded-full bg-amber-500 group-hover:shadow-[0_0_7px_1px_var(--color-amber-500)]" />
    );
  }
  return (
    <span className="size-[5px] rounded-full bg-addition transition-shadow group-hover:animate-pulse group-hover:shadow-[0_0_7px_1px_var(--addition)]" />
  );
}

export function CiBar({ pull }: { pull: QueuePull }) {
  const { failed, passed, pending } = pull.ciCounts;
  if (failed + passed + pending === 0) {
    return null;
  }
  return (
    <SignalTip
      className="inline-flex size-4 items-center justify-center"
      label={ciLabel(pull)}
    >
      <GlowDot pull={pull} />
    </SignalTip>
  );
}
