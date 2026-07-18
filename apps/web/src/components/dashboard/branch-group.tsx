import type { QueuePull } from "@sphynx/schema/review-queue";
import { cn } from "@sphynx/ui/lib/utils";
import { StackRows } from "@/components/dashboard/stack-rows";
import type { BranchGroup as BranchGroupData } from "@/lib/attention";

interface BranchGroupProps {
  focusedKey: string | null;
  group: BranchGroupData;
  now: number;
  onFocus: (key: string) => void;
  onOpen: (pull: QueuePull) => void;
}

export function BranchGroup({
  focusedKey,
  group,
  now,
  onFocus,
  onOpen,
}: BranchGroupProps) {
  return (
    <div className="flex flex-col gap-1">
      <p className="flex items-baseline gap-2 px-2.5 pt-1 pb-0.5">
        <span
          aria-hidden
          className={cn(
            "size-[7px] shrink-0 self-center rounded-full",
            group.isStage
              ? "bg-foreground"
              : "border border-muted-foreground bg-transparent"
          )}
        />
        <span
          className={cn(
            "font-mono text-xs",
            group.isStage ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {group.branch}
        </span>
        <span className="text-[11px] text-muted-foreground/60 tabular-nums">
          {group.total}
        </span>
        {group.mergeable > 0 ? (
          <span className="text-[11px] text-addition/80">
            · {group.mergeable} mergeable
          </span>
        ) : null}
        {group.contested > 0 ? (
          <span className="text-[11px] text-deletion/80">
            · {group.contested} contested
          </span>
        ) : null}
      </p>
      <StackRows
        depth={0}
        focusedKey={focusedKey}
        nodes={group.nodes}
        now={now}
        onFocus={onFocus}
        onOpen={onOpen}
      />
    </div>
  );
}
