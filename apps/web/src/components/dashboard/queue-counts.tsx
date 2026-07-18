import { SignalTip } from "@/components/dashboard/signal-tip";
import { plural } from "@/lib/claims";

interface QueueCountsProps {
  contested: number;
  mergeable: number;
  total: number;
}

function countsLabel(mergeable: number, contested: number, other: number) {
  const parts: string[] = [];
  if (mergeable > 0) {
    parts.push(`${mergeable} mergeable`);
  }
  if (contested > 0) {
    parts.push(`${contested} contested`);
  }
  if (other > 0) {
    parts.push(`${other} in review`);
  }
  return parts.length > 0 ? parts.join(" · ") : plural(0, "open pull");
}

export function QueueCounts({ contested, mergeable, total }: QueueCountsProps) {
  const other = Math.max(total - mergeable - contested, 0);
  return (
    <SignalTip
      className="flex shrink-0 items-center gap-1.5"
      label={countsLabel(mergeable, contested, other)}
    >
      <span
        className="flex h-[3px] gap-[1.5px] overflow-hidden rounded-full"
        style={{ width: Math.min(16 + total * 1.1, 34) }}
      >
        {mergeable > 0 ? (
          <span
            className="rounded-full bg-addition"
            style={{ flexGrow: mergeable }}
          />
        ) : null}
        {contested > 0 ? (
          <span
            className="rounded-full bg-deletion"
            style={{ flexGrow: contested }}
          />
        ) : null}
        {other > 0 ? (
          <span
            className="rounded-full bg-muted-foreground/30"
            style={{ flexGrow: other }}
          />
        ) : null}
      </span>
      <span className="w-4 text-right text-[11px] text-muted-foreground/70 tabular-nums">
        {total}
      </span>
    </SignalTip>
  );
}
