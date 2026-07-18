import type { QueuePull, StageGap } from "@sphynx/schema/review-queue";
import { BranchGroup } from "@/components/dashboard/branch-group";
import { ShippedGroup } from "@/components/dashboard/shipped-group";
import type { BranchQueue } from "@/lib/attention";

interface QueuePaneProps {
  focusedKey: string | null;
  now: number;
  onFocus: (key: string) => void;
  onOpen: (pull: QueuePull) => void;
  onOpenNumber: (number: number) => void;
  queue: BranchQueue;
  shipped: readonly StageGap[];
}

export function QueuePane({
  focusedKey,
  now,
  onFocus,
  onOpen,
  onOpenNumber,
  queue,
  shipped,
}: QueuePaneProps) {
  if (queue.groups.length === 0 && shipped.length === 0) {
    return (
      <p className="px-2.5 py-4 text-muted-foreground text-sm">
        No open pull requests.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {queue.groups.map((group) => (
        <BranchGroup
          focusedKey={focusedKey}
          group={group}
          key={group.branch}
          now={now}
          onFocus={onFocus}
          onOpen={onOpen}
        />
      ))}
      {shipped.map((gap) => (
        <ShippedGroup
          gap={gap}
          key={`${gap.from}->${gap.to}`}
          now={now}
          onOpenNumber={onOpenNumber}
        />
      ))}
    </div>
  );
}
