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
    <div className="flex flex-col">
      <p className="sticky top-0 z-[9] -mx-4 flex h-9 items-center gap-2 border-border border-b bg-card px-[26px]">
        <span
          className={cn(
            "font-heading font-medium text-[13px] tracking-tight",
            group.isStage ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {group.branch}
        </span>
        <span className="text-muted-foreground/60 text-xs tabular-nums">
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
