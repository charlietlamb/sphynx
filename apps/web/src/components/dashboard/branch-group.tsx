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
      <p className="-mx-4 mb-1 flex items-baseline gap-2 border-border border-b px-[26px] pt-1 pb-2">
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
      </p>
      <StackRows
        focusedKey={focusedKey}
        nodes={group.nodes}
        now={now}
        onFocus={onFocus}
        onOpen={onOpen}
      />
    </div>
  );
}
