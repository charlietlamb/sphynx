import type { QueuePull } from "@sphynx/schema/review-queue";
import { BranchGroup } from "@/components/dashboard/branch-group";
import type { BranchQueue } from "@/lib/attention";

interface QueuePaneProps {
  focusedKey: string | null;
  now: number;
  onFocus: (key: string) => void;
  onOpen: (pull: QueuePull) => void;
  queue: BranchQueue;
}

export function QueuePane({
  focusedKey,
  now,
  onFocus,
  onOpen,
  queue,
}: QueuePaneProps) {
  if (queue.groups.length === 0) {
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
    </div>
  );
}
