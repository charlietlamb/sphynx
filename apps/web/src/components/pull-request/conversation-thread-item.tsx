import type { ReviewThread } from "@sphynx/schema/pull-request-comments";
import { cn } from "@sphynx/ui/lib/utils";
import {
  CommentThread,
  type ThreadCommenting,
} from "@/components/pull-request/comment-thread";
import { baseName } from "@/lib/paths";

interface ConversationThreadItemProps {
  commenting: ThreadCommenting;
  focused: boolean;
  onToggleFocus: () => void;
  originalLines: readonly string[];
  thread: ReviewThread;
}

export function ConversationThreadItem({
  commenting,
  focused,
  onToggleFocus,
  originalLines,
  thread,
}: ConversationThreadItemProps) {
  return (
    <CommentThread
      anchor={
        <button
          className={cn(
            "inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[11px] transition-colors",
            focused
              ? "bg-primary/12 text-primary"
              : "bg-muted/50 text-foreground/80 hover:bg-muted"
          )}
          onClick={onToggleFocus}
          type="button"
        >
          {baseName(thread.path)}
          <span className="text-muted-foreground/50">:{thread.line}</span>
          {thread.isOutdated ? (
            <span className="ml-1.5 text-muted-foreground/50">outdated</span>
          ) : null}
        </button>
      }
      commenting={commenting}
      originalLines={originalLines}
      thread={thread}
    />
  );
}
