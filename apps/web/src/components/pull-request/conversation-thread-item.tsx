import { CaretRightIcon } from "@phosphor-icons/react";
import type { ReviewThread } from "@sphynx/schema/pull-request-comments";
import { cn } from "@sphynx/ui/lib/utils";
import {
  CommentThread,
  type ThreadCommenting,
} from "@/components/pull-request/comment-thread";

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
    <div
      className={cn(
        "overflow-hidden rounded-md border bg-background",
        focused ? "border-primary/50" : "border-border"
      )}
    >
      <button
        className="flex w-full items-center gap-2 border-border border-b px-3.5 py-2 text-left transition-colors hover:bg-muted/40"
        onClick={onToggleFocus}
        type="button"
      >
        <span className="min-w-0 truncate font-mono text-[11px] text-foreground/90">
          {thread.path}:{thread.line}
        </span>
        {thread.isOutdated ? (
          <span className="shrink-0 text-[11px] text-muted-foreground/60">
            outdated
          </span>
        ) : null}
        <CaretRightIcon
          className={cn(
            "ml-auto size-3 shrink-0 text-muted-foreground/60 transition-transform",
            focused && "rotate-90"
          )}
        />
      </button>
      <CommentThread
        className="m-0 w-full max-w-none rounded-none border-0 shadow-none"
        commenting={commenting}
        originalLines={originalLines}
        thread={thread}
      />
    </div>
  );
}
