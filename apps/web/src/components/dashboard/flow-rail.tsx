import { GitBranchIcon } from "@phosphor-icons/react";
import type { RepoFlow } from "@sphynx/schema/review-queue";
import { RailBackflow } from "@/components/dashboard/rail-backflow";
import { RailBranch } from "@/components/dashboard/rail-branch";
import { RailGapQueue } from "@/components/dashboard/rail-gap-queue";
import { SectionHeader } from "@/components/layout/section-header";
import type { RailBranchItem } from "@/lib/attention";

interface FlowRailProps {
  canAct: boolean;
  flow: RepoFlow;
  items: readonly RailBranchItem[];
  now: number;
  onOpenNumber: (number: number) => void;
  onSelect: (branch: string | null) => void;
  selected: string | null;
}

function hintMap(items: readonly RailBranchItem[]) {
  return new Map(
    items.map((item, index) => [item.branch, index < 9 ? index + 1 : null])
  );
}

export function FlowRail({
  canAct,
  flow,
  items,
  now,
  onOpenNumber,
  onSelect,
  selected,
}: FlowRailProps) {
  const tributaries = items.filter((item) => !item.isStage);
  const stages = items.filter((item) => item.isStage);
  const hints = hintMap(items);
  const base = flow.stages[0] ?? null;
  const top = flow.stages.at(-1) ?? null;
  const canBackflow = base !== null && top !== null && base !== top;
  return (
    <div className="flex flex-col">
      <SectionHeader
        action={
          selected ? (
            <button
              className="text-muted-foreground/60 text-xs underline-offset-2 transition-colors hover:text-foreground hover:underline"
              onClick={() => onSelect(null)}
              type="button"
            >
              show all
            </button>
          ) : null
        }
        className="-mx-3 mb-3 px-3"
        icon={<GitBranchIcon className="size-3" weight="fill" />}
        label="Flow"
      />
      <div className="relative flex flex-col">
        <span
          aria-hidden
          className="absolute top-1 bottom-[13px] left-[13px] w-[2px] rounded-full bg-gradient-to-b from-border via-muted-foreground/30 to-muted-foreground/30"
        />
        {tributaries.map((item) => (
          <RailBranch
            active={selected === item.branch}
            hint={hints.get(item.branch) ?? null}
            item={item}
            key={item.branch}
            onSelect={() =>
              onSelect(selected === item.branch ? null : item.branch)
            }
          />
        ))}
        {stages.map((item) => {
          const gap = flow.gaps.find(
            (candidate) => candidate.from === item.branch
          );
          return (
            <div className="flex flex-col" key={item.branch}>
              <RailBranch
                active={selected === item.branch}
                hint={hints.get(item.branch) ?? null}
                item={item}
                onSelect={() =>
                  onSelect(selected === item.branch ? null : item.branch)
                }
              />
              {gap ? (
                <RailGapQueue
                  canAct={canAct}
                  gap={gap}
                  now={now}
                  onOpenNumber={onOpenNumber}
                  owner={flow.owner}
                  repo={flow.repo}
                />
              ) : null}
            </div>
          );
        })}
        {canBackflow && base && top ? (
          <div className="pt-2 pl-7">
            <RailBackflow
              canAct={canAct}
              from={top}
              onOpenNumber={onOpenNumber}
              openPulls={flow.openPulls}
              owner={flow.owner}
              repo={flow.repo}
              to={base}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
