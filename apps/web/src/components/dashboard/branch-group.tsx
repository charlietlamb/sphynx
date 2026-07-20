import type { QueuePull } from "@sphynx/schema/review-queue";
import { cn } from "@sphynx/ui/lib/utils";
import { StackRows } from "@/components/dashboard/stack-rows";
import type { BranchGroup as BranchGroupData } from "@/lib/attention";

interface BranchGroupProps {
  first: boolean;
  focusedKey: string | null;
  group: BranchGroupData;
  now: number;
  onFocus: (key: string) => void;
  onOpen: (pull: QueuePull) => void;
}

export function BranchGroup({
  first,
  focusedKey,
  group,
  now,
  onFocus,
  onOpen,
}: BranchGroupProps) {
  return (
    <div className="flex flex-col">
      <p
        className={cn(
          "sticky top-9 z-[9] -mx-4 flex h-9 items-center gap-2 border-border border-b bg-card px-[26px]",
          !first && "border-t"
        )}
      >
        <span
          className={cn(
            "font-heading font-medium text-[13px] tracking-tight",
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
