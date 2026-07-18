import type { StageGap } from "@sphynx/schema/review-queue";
import { ShippedRow } from "@/components/dashboard/shipped-row";

interface ShippedGroupProps {
  gap: StageGap;
  now: number;
  onOpenNumber: (number: number) => void;
}

export function ShippedGroup({ gap, now, onOpenNumber }: ShippedGroupProps) {
  if (gap.pulls.length === 0) {
    return null;
  }
  const extra = gap.aheadBy - gap.pulls.length - gap.directCommits;
  return (
    <div className="flex flex-col gap-1">
      <p className="flex items-baseline gap-2 px-2.5 pt-1 pb-0.5 font-mono text-[11px] text-muted-foreground/60">
        shipped to {gap.from} · waiting for {gap.to}
        <span className="tabular-nums">{gap.pulls.length}</span>
      </p>
      {gap.pulls.map((pull) => (
        <ShippedRow
          key={pull.number}
          now={now}
          onOpen={() => onOpenNumber(pull.number)}
          pull={pull}
        />
      ))}
      {gap.directCommits > 0 || extra > 0 ? (
        <p className="px-2.5 font-mono text-[10px] text-muted-foreground/50">
          {gap.directCommits > 0
            ? `+ ${gap.directCommits} direct commit${gap.directCommits === 1 ? "" : "s"}`
            : ""}
          {gap.directCommits > 0 && extra > 0 ? " · " : ""}
          {extra > 0 ? `${extra} more not shown` : ""}
        </p>
      ) : null}
    </div>
  );
}
