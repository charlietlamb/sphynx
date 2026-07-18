import type { RepoFlow } from "@sphynx/schema/review-queue";
import { RailBranch } from "@/components/dashboard/rail-branch";
import { RailGap } from "@/components/dashboard/rail-gap";
import type { RailBranchItem } from "@/lib/attention";

interface FlowRailProps {
  flow: RepoFlow;
  items: readonly RailBranchItem[];
  onSelect: (branch: string | null) => void;
  selected: string | null;
}

export function FlowRail({ flow, items, onSelect, selected }: FlowRailProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between px-2">
        <p className="font-mono text-[11px] text-muted-foreground/60">flow</p>
        {selected ? (
          <button
            className="font-mono text-[10px] text-muted-foreground/60 underline-offset-2 transition-colors hover:text-foreground hover:underline"
            onClick={() => onSelect(null)}
            type="button"
          >
            show all
          </button>
        ) : null}
      </div>
      <div className="flex flex-col">
        {items.map((item, index) => {
          const gap = item.isStage
            ? flow.gaps.find((candidate) => candidate.from === item.branch)
            : undefined;
          return (
            <div className="flex flex-col" key={item.branch}>
              <RailBranch
                active={selected === item.branch}
                hint={index < 9 ? index + 1 : null}
                item={item}
                onSelect={() =>
                  onSelect(selected === item.branch ? null : item.branch)
                }
              />
              {gap ? <RailGap gap={gap} /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
