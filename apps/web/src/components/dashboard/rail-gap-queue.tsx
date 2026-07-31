import { CheckCircleIcon, HourglassMediumIcon } from "@phosphor-icons/react";
import type { StageGap } from "@sphynx/schema/review-queue";
import { RailPromotion } from "@/components/dashboard/rail-promotion";
import { ageDays, shortAge } from "@/lib/age";
import { plural } from "@/lib/claims";

const MAX_ROWS = 10;
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
      <div className="relative pl-7">
        <div className="flex h-7 items-center gap-1.5">
          <span
            aria-hidden
            className="absolute left-[14px] h-px w-[10px] bg-border"
          />
          <CheckCircleIcon
            className="size-3.5 shrink-0 text-addition"
            weight="fill"
          />
          <p className="text-[11px] text-muted-foreground">
            in sync with <span className="font-mono">{gap.to}</span>
          </p>
        </div>
        {gap.promotionPull === null ? null : (
          <RailPromotion
            canAct={canAct}
            gap={gap}
            onOpenNumber={onOpenNumber}
            owner={owner}
            repo={repo}
          />
        )}
      </div>
    );
  }
  const shown = gap.pulls.slice(0, MAX_ROWS);
  const extra = gap.pulls.length - shown.length;
  const oldest = gap.pulls.at(-1)?.mergedAt;
  const oldestDays = oldest ? Math.round(ageDays(oldest, now)) : null;
  const meta: { key: string; label: string; className?: string }[] = [];
  if (oldestDays) {
    meta.push({
      key: "oldest",
      label: `${oldestDays}d oldest`,
      className:
        oldestDays >= STALE_GAP_DAYS ? "font-medium text-amber-500" : undefined,
    });
  }
  if (extra > 0) {
    meta.push({ key: "more", label: `+${extra} more` });
  }
  if (gap.directCommits > 0) {
    meta.push({
      key: "commits",
      label: plural(gap.directCommits, "direct commit"),
    });
  }
  return (
    <div className="relative py-0.5 pl-7">
      <span
        aria-hidden
        className="absolute top-0 bottom-0 left-[13px] w-[2px] bg-amber-500/70"
      />
      <p className="flex items-center gap-1.5 py-0.5 font-medium text-[11px] text-foreground">
        <HourglassMediumIcon
          className="size-3.5 shrink-0 text-amber-500"
          weight="fill"
        />
        waiting for <span className="font-mono">{gap.to}</span>
        <span className="text-muted-foreground/70 tabular-nums">
          {gap.pulls.length > 0 ? gap.pulls.length : gap.aheadBy}
        </span>
      </p>
      {shown.map((pull) => (
        <button
          className="flex h-7 w-full min-w-0 items-center gap-2 rounded-sm text-left transition-colors hover:bg-alpha-4"
          key={pull.number}
          onClick={() => onOpenNumber(pull.number)}
          type="button"
        >
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground/70 tabular-nums">
            #{pull.number}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
            {pull.title}
          </span>
          <span className="shrink-0 text-[11px] text-muted-foreground/60 tabular-nums">
            {pull.mergedAt ? shortAge(pull.mergedAt, now) : ""}
          </span>
        </button>
      ))}
      {meta.length > 0 ? (
        <div className="flex items-center gap-1.5 py-0.5 text-[11px] text-muted-foreground/70 tabular-nums">
          {meta.map((entry, index) => (
            <span className="flex items-center gap-1.5" key={entry.key}>
              {index > 0 ? (
                <span aria-hidden className="text-muted-foreground/30">
                  ·
                </span>
              ) : null}
              <span className={entry.className}>{entry.label}</span>
            </span>
          ))}
        </div>
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
