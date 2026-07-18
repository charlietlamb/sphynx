import type { StageGap } from "@sphynx/schema/review-queue";
import { cn } from "@sphynx/ui/lib/utils";
import { RailPromotion } from "@/components/dashboard/rail-promotion";
import { ageDays, shortAge } from "@/lib/age";
import { plural } from "@/lib/claims";

const MAX_ROWS = 3;
const STALE_GAP_DAYS = 5;

interface RailGapQueueProps {
  canAct: boolean;
  gap: StageGap;
  now: number;
  onOpenNumber: (number: number) => void;
  owner: string;
  repo: string;
}

export function RailGapQueue({
  canAct,
  gap,
  now,
  onOpenNumber,
  owner,
  repo,
}: RailGapQueueProps) {
  if (gap.aheadBy === 0) {
    return (
      <div className="relative flex h-6 items-center pl-7">
        <span
          aria-hidden
          className="absolute left-[15px] h-px w-[9px] bg-border"
        />
        <p className="text-[10px] text-muted-foreground/40">
          in sync with {gap.to}
        </p>
      </div>
    );
  }
  const shown = gap.pulls.slice(0, MAX_ROWS);
  const extra = gap.pulls.length - shown.length;
  const oldest = gap.pulls.at(-1)?.mergedAt;
  const oldestDays = oldest ? Math.round(ageDays(oldest, now)) : null;
  return (
    <div className="relative py-0.5 pl-7">
      <span
        aria-hidden
        className="absolute top-0 bottom-0 left-[13px] w-[2px] rounded-full bg-amber-500/70"
      />
      <p className="flex items-baseline gap-2 py-0.5 text-[11px] text-muted-foreground">
        waiting for {gap.to}
        <span className="text-muted-foreground/60 tabular-nums">
          {gap.pulls.length > 0 ? gap.pulls.length : gap.aheadBy}
        </span>
      </p>
      {shown.map((pull) => (
        <button
          className="flex h-6 w-full min-w-0 items-center gap-2 rounded-sm text-left transition-colors hover:bg-alpha-4"
          key={pull.number}
          onClick={() => onOpenNumber(pull.number)}
          type="button"
        >
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground/50 tabular-nums">
            #{pull.number}
          </span>
          <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
            {pull.title}
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground/40 tabular-nums">
            {pull.mergedAt ? shortAge(pull.mergedAt, now) : ""}
          </span>
        </button>
      ))}
      {oldestDays !== null && oldestDays > 0 ? (
        <p
          className={cn(
            "py-0.5 text-[10px]",
            oldestDays >= STALE_GAP_DAYS
              ? "text-amber-500"
              : "text-muted-foreground/40"
          )}
        >
          oldest waiting {oldestDays}d
        </p>
      ) : null}
      {extra > 0 || gap.directCommits > 0 ? (
        <p className="py-0.5 text-[10px] text-muted-foreground/40">
          {extra > 0 ? `${extra} more` : ""}
          {extra > 0 && gap.directCommits > 0 ? " · " : ""}
          {gap.directCommits > 0
            ? plural(gap.directCommits, "direct commit")
            : ""}
        </p>
      ) : null}
      <RailPromotion
        canAct={canAct}
        gap={gap}
        onOpenNumber={onOpenNumber}
        owner={owner}
        repo={repo}
      />
    </div>
  );
}
