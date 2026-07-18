import type { QueuePull } from "@sphynx/schema/review-queue";
import { QueueRow } from "@/components/dashboard/queue-row";
import { pullKey, type StackNode } from "@/lib/attention";

interface StackRowsProps {
  depth: number;
  focusedKey: string | null;
  nodes: readonly StackNode[];
  now: number;
  onFocus: (key: string) => void;
  onOpen: (pull: QueuePull) => void;
}

export function StackRows({
  depth,
  focusedKey,
  now,
  nodes,
  onFocus,
  onOpen,
}: StackRowsProps) {
  return (
    <div className="flex flex-col gap-0.5">
      {nodes.map((node) => {
        const key = pullKey(node.pull);
        return (
          <div className="flex flex-col gap-0.5" key={key}>
            <QueueRow
              focused={key === focusedKey}
              now={now}
              onFocus={() => onFocus(key)}
              onOpen={() => onOpen(node.pull)}
              pull={node.pull}
            />
            {node.children.length > 0 ? (
              <div className="ml-4 border-border border-l pl-2">
                <StackRows
                  depth={depth + 1}
                  focusedKey={focusedKey}
                  nodes={node.children}
                  now={now}
                  onFocus={onFocus}
                  onOpen={onOpen}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
