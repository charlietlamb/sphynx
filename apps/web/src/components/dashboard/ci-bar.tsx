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

interface CiDot {
  className: string;
  key: string;
}

function bucketDots(name: string, className: string, count: number): CiDot[] {
  return Array.from({ length: count }, (_, position) => ({
    className,
    key: `${name}-${position}`,
  }));
}

function allocateDots(counts: QueuePull["ciCounts"]): CiDot[] {
  const buckets = [
    { name: "failed", className: "bg-deletion", count: counts.failed },
    {
      name: "pending",
      className: "animate-pulse bg-amber-500",
      count: counts.pending,
    },
    { name: "passed", className: "bg-addition", count: counts.passed },
  ].filter((bucket) => bucket.count > 0);
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  if (total <= MAX_DOTS) {
    return buckets.flatMap((bucket) =>
      bucketDots(bucket.name, bucket.className, bucket.count)
    );
  }
  const spare = MAX_DOTS - buckets.length;
  let used = 0;
  const dots = buckets.flatMap((bucket) => {
    const extra = Math.min(
      Math.round(((bucket.count - 1) / total) * spare),
      spare - used
    );
    used += extra;
    return bucketDots(bucket.name, bucket.className, 1 + extra);
  });
  const last = dots.at(-1);
  while (last && dots.length < MAX_DOTS) {
    dots.push({ ...last, key: `${last.key}-fill-${dots.length}` });
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
      {dots.map((dot) => (
        <span
          className={cn("size-[4px] rounded-full", dot.className)}
          key={dot.key}
        />
      ))}
    </SignalTip>
  );
}
