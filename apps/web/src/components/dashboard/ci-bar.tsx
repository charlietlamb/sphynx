import type { QueuePull } from "@sphynx/schema/review-queue";
import { cn } from "@sphynx/ui/lib/utils";
import { SignalTip } from "@/components/dashboard/signal-tip";
import { plural } from "@/lib/claims";

const MAX_DOTS = 5;

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

function allocateDots(counts: QueuePull["ciCounts"]) {
  const buckets = [
    { className: "bg-deletion", count: counts.failed },
    { className: "animate-pulse bg-amber-500", count: counts.pending },
    { className: "bg-addition", count: counts.passed },
  ].filter((bucket) => bucket.count > 0);
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  if (total <= MAX_DOTS) {
    return buckets.flatMap((bucket) =>
      Array.from({ length: bucket.count }, () => bucket.className)
    );
  }
  const dots: string[] = [];
  let remaining = MAX_DOTS - buckets.length;
  for (const bucket of buckets) {
    const extra = Math.round(((bucket.count - 1) / total) * remaining);
    dots.push(
      ...Array.from(
        { length: 1 + Math.min(extra, remaining) },
        () => bucket.className
      )
    );
    remaining -= Math.min(extra, remaining);
  }
  while (dots.length < MAX_DOTS && dots.length > 0) {
    dots.push(dots.at(-1) ?? "");
  }
  return dots.slice(0, MAX_DOTS);
}

export function CiBar({ pull }: { pull: QueuePull }) {
  const { failed, passed, pending } = pull.ciCounts;
  if (failed + passed + pending === 0) {
    return null;
  }
  const dots = allocateDots(pull.ciCounts);
  return (
    <SignalTip className="flex items-center gap-[3px]" label={ciLabel(pull)}>
      {dots.map((className, index) => (
        <span
          className={cn("size-[4px] rounded-full", className)}
          key={`${className}-${
            // biome-ignore lint/suspicious/noArrayIndexKey: dots are positional
            index
          }`}
        />
      ))}
    </SignalTip>
  );
}
