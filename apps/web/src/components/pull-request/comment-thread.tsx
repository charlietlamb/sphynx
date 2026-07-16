import { CaretDownIcon, CaretRightIcon } from "@phosphor-icons/react";
import type { ReviewThread } from "@sphynx/schema/pull-request-comments";
import { Badge } from "@sphynx/ui/components/ui/badge";
import { useState } from "react";
import { CommentComposer } from "@/components/pull-request/comment-composer";
import { CommentItem } from "@/components/pull-request/comment-item";
import { CommentThreadFooter } from "@/components/pull-request/comment-thread-footer";
import type { ReviewCommenting } from "@/components/pull-request/use-review-comments";

interface CommentThreadProps {
  commenting: ReviewCommenting;
  originalLines: readonly string[];
  thread: ReviewThread;
}

export function CommentThread({
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

  return (
    <div className="my-2.5 mr-4 ml-1 max-w-3xl overflow-hidden rounded-lg border border-border bg-background font-sans shadow-xs">
      {thread.isResolved ? (
        <button
          className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-muted-foreground text-xs hover:bg-muted/40"
          onClick={() => setExpanded((open) => !open)}
          type="button"
        >
          {collapsed ? (
            <CaretRightIcon className="size-3" />
          ) : (
            <CaretDownIcon className="size-3" />
          )}
          <Badge variant="outline">Resolved</Badge>
          <span className="truncate">
            {thread.comments[0]?.author?.login ?? "unknown"} ·{" "}
            {thread.comments.length}{" "}
            {thread.comments.length === 1 ? "comment" : "comments"}
          </span>
        </button>
      ) : null}
      {collapsed ? null : (
        <>
          {thread.comments.map((comment, index) => (
            <CommentItem
              comment={comment}
              key={comment.id}
              originalLines={originalLines}
              topBorder={index > 0 || thread.isResolved}
            />
          ))}
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
        </>
      )}
    </div>
  );
}
