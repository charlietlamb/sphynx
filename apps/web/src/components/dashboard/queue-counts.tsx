import { SignalTip } from "@/components/dashboard/signal-tip";

interface QueueCountsProps {
  contested: number;
  mergeable: number;
  total: number;
}

export function QueueCounts({ contested, mergeable, total }: QueueCountsProps) {
  return (
    <span className="shrink-0 text-[11px] tabular-nums">
      {mergeable > 0 ? (
        <>
          <SignalTip label={`${mergeable} approved and green, ready to merge`}>
            <span className="text-addition">{mergeable}</span>
          </SignalTip>
          <span className="text-muted-foreground/40"> · </span>
        </>
      ) : null}
      {contested > 0 ? (
        <>
          <SignalTip
            label={`${contested} contested, failing checks or changes requested`}
          >
            <span className="text-deletion">{contested}</span>
          </SignalTip>
          <span className="text-muted-foreground/40"> · </span>
        </>
      ) : null}
      <span className="text-muted-foreground/60">{total}</span>
    </span>
  );
}
