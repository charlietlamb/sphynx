import type { StageGap } from "@sphynx/schema/review-queue";

interface RailGapProps {
  gap: StageGap;
}

export function RailGap({ gap }: RailGapProps) {
  return (
    <div className="ml-[10px] flex items-stretch gap-2.5 border-border border-l py-1 pl-3">
      {gap.aheadBy === 0 ? (
        <p className="font-mono text-[10px] text-muted-foreground/50">
          in sync with {gap.to}
        </p>
      ) : (
        <p className="font-mono text-[10px] text-muted-foreground">
          <span style={{ color: "var(--color-amber-500)" }}>◈ </span>
          {gap.aheadBy} commit{gap.aheadBy === 1 ? "" : "s"} waiting
          {gap.promotionPull ? (
            <span className="text-muted-foreground/60">
              {" "}
              · promotion #{gap.promotionPull}
            </span>
          ) : null}
        </p>
      )}
    </div>
  );
}
