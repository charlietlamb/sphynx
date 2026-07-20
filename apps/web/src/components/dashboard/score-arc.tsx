import { STRONG_SCORE, WEAK_SCORE } from "@/lib/score";

const ARC_CIRCUMFERENCE = 2 * Math.PI * 6;

function scoreStroke(ratio: number) {
  if (ratio >= STRONG_SCORE) {
    return "stroke-addition";
  }
  if (ratio < WEAK_SCORE) {
    return "stroke-deletion";
  }
  return "stroke-amber-500";
}

export function ScoreArc({ ratio }: { ratio: number }) {
  return (
    <svg aria-hidden="true" className="size-3.5 -rotate-90" viewBox="0 0 16 16">
      <circle
        className="stroke-muted-foreground/20"
        cx="8"
        cy="8"
        fill="none"
        r="6"
        strokeWidth="2.5"
      />
      <circle
        className={scoreStroke(ratio)}
        cx="8"
        cy="8"
        fill="none"
        r="6"
        strokeDasharray={`${ratio * ARC_CIRCUMFERENCE} ${ARC_CIRCUMFERENCE}`}
        strokeLinecap="round"
        strokeWidth="2.5"
      />
    </svg>
  );
}
