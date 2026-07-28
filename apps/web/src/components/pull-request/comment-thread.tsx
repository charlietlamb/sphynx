import { CaretRightIcon } from "@phosphor-icons/react";
import type { ReviewThread } from "@sphynx/schema/pull-request-comments";
import { Badge } from "@sphynx/ui/components/ui/badge";
import { cn } from "@sphynx/ui/lib/utils";
import type { ReactNode } from "react";
import { useState } from "react";
import { CommentComposer } from "@/components/pull-request/comment-composer";
import { CommentItem } from "@/components/pull-request/comment-item";
import { CommentThreadFooter } from "@/components/pull-request/comment-thread-footer";
import type { ReviewCommenting } from "@/components/pull-request/use-review-comments";
import { plural } from "@/lib/claims";

export type ThreadCommenting = Pick<
  ReviewCommenting,
  "canComment" | "reply" | "replying" | "resolve"
>;

interface CommentThreadProps {
  /** The file:line control shown in the header; also the focus toggle in the feed. */
  anchor?: ReactNode;
  className?: string;
  commenting: ThreadCommenting;
  originalLines: readonly string[];
  thread: ReviewThread;
}

export function CommentThread({
  anchor,
  className,
  commenting,
  originalLines,
  thread,
}: CommentThreadProps) {
  const [expanded, setExpanded] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const collapsed = thread.isResolved && !expanded;
  const rootCommentId = thread.comments[0]?.id;
  const canReply =
    commenting.canComment && rootCommentId !== undefined && rootCommentId > 0;
  const threadId = thread.id;
  const onResolve =
    threadId && thread.viewerCanResolve
      ? () => commenting.resolve({ threadId, resolved: !thread.isResolved })
      : null;

  const submitReply = (body: string) => {
    if (rootCommentId !== undefined) {
      commenting.reply({ body, commentId: rootCommentId });
    }
    setReplyOpen(false);
  };

  if (collapsed) {
    return (
      <button
        className={cn(
          "flex w-full items-center gap-2 text-left text-muted-foreground text-xs",
          className
        )}
        onClick={() => setExpanded(true)}
        type="button"
      >
        <CaretRightIcon className="size-3 shrink-0" />
        <Badge variant="outline">Resolved</Badge>
        {anchor}
        <span className="truncate">
          {thread.comments[0]?.author?.login ?? "unknown"} ·{" "}
          {plural(thread.comments.length, "comment")}
        </span>
      </button>
    );
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      {anchor ? (
        <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
          <span>Comment on</span>
          {anchor}
          {thread.isResolved ? <Badge variant="outline">Resolved</Badge> : null}
        </div>
      ) : null}
      <div className="flex flex-col gap-3">
        {thread.comments.map((comment) => (
          <CommentItem
            comment={comment}
            key={comment.id}
            originalLines={originalLines}
          />
        ))}
      </div>
      {replyOpen ? (
        <CommentComposer
          busy={commenting.replying}
          hasPendingReview={false}
          mode="reply"
          onCancel={() => setReplyOpen(false)}
          onSubmit={submitReply}
          suggestionSeed={originalLines.join("\n")}
          variant="inline"
        />
      ) : null}
      {(canReply || onResolve) && !replyOpen ? (
        <CommentThreadFooter
          canReply={canReply}
          onReply={() => setReplyOpen(true)}
          onResolve={onResolve}
          resolved={thread.isResolved}
        />
      ) : null}
    </div>
  );
}
