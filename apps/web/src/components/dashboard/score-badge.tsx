import { cn } from "@sphynx/ui/lib/utils";
import { ScoreArc } from "@/components/dashboard/score-arc";
import { scoreClass } from "@/lib/score";

interface ScoreBadgeProps {
  label: string;
  ratio: number;
}

export function ScoreBadge({ label, ratio }: ScoreBadgeProps) {
  return (
    <>
      <ScoreArc ratio={ratio} />
      <span
        className={cn(
          "font-semibold text-[12px] tabular-nums leading-none",
          scoreClass(ratio)
        )}
      >
        {label}
      </span>
    </>
  );
}
