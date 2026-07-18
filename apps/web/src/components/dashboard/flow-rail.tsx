import type { RepoFlow } from "@sphynx/schema/review-queue";
import { RailBranch } from "@/components/dashboard/rail-branch";
import { RailGapQueue } from "@/components/dashboard/rail-gap-queue";
import { RailStuck } from "@/components/dashboard/rail-stuck";
import type { RailBranchItem, StuckPull } from "@/lib/attention";

interface FlowRailProps {
  flow: RepoFlow;
  items: readonly RailBranchItem[];
  now: number;
  onFocusPull: (key: string) => void;
  onOpenNumber: (number: number) => void;
  onSelect: (branch: string | null) => void;
  selected: string | null;
  stuck: readonly StuckPull[];
}

function hintFor(items: readonly RailBranchItem[], item: RailBranchItem) {
  const index = items.indexOf(item);
  return index >= 0 && index < 9 ? index + 1 : null;
}

export function FlowRail({
  flow,
  items,
  now,
  onFocusPull,
  onOpenNumber,
  onSelect,
  selected,
  stuck,
}: FlowRailProps) {
  const tributaries = items.filter((item) => !item.isStage);
  const stages = items.filter((item) => item.isStage);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between px-2">
        <p className="font-medium text-[11px] text-muted-foreground/60">flow</p>
        {selected ? (
          <button
            className="text-[11px] text-muted-foreground/60 underline-offset-2 transition-colors hover:text-foreground hover:underline"
            onClick={() => onSelect(null)}
            type="button"
          >
            show all
          </button>
        ) : null}
      </div>
      <div className="flex flex-col">
        {tributaries.map((item) => (
          <RailBranch
            active={selected === item.branch}
            hint={hintFor(items, item)}
            item={item}
            key={item.branch}
            onSelect={() =>
              onSelect(selected === item.branch ? null : item.branch)
            }
          />
        ))}
        {tributaries.length > 0 ? (
          <span aria-hidden className="ml-[13px] h-2 w-px bg-border" />
        ) : null}
        {stages.map((item) => {
          const gap = flow.gaps.find(
            (candidate) => candidate.from === item.branch
          );
          return (
            <div className="flex flex-col" key={item.branch}>
              <RailBranch
                active={selected === item.branch}
                hint={hintFor(items, item)}
                item={item}
                onSelect={() =>
                  onSelect(selected === item.branch ? null : item.branch)
                }
              />
              {gap ? (
                <RailGapQueue gap={gap} now={now} onOpenNumber={onOpenNumber} />
              ) : null}
            </div>
          );
        })}
        <div className="mt-1 flex items-center gap-2 px-2">
          <span aria-hidden className="h-px flex-1 bg-border" />
          <span className="text-[10px] text-muted-foreground/40">
            production
          </span>
        </div>
      </div>
      <RailStuck now={now} onFocus={onFocusPull} stuck={stuck} />
    </div>
  );
}
