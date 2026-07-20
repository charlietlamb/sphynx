import { CaretDownIcon, CaretRightIcon } from "@phosphor-icons/react";
import type { ReviewThread } from "@sphynx/schema/pull-request-comments";
import { Badge } from "@sphynx/ui/components/ui/badge";
import { cn } from "@sphynx/ui/lib/utils";
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
  className?: string;
  commenting: ThreadCommenting;
  originalLines: readonly string[];
  thread: ReviewThread;
}

export function CommentThread({
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

  return (
    <div
      className={cn(
        "my-2.5 mr-4 ml-1 max-w-3xl overflow-hidden rounded-md border border-border bg-background font-sans shadow-xs",
        className
      )}
    >
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
            {plural(thread.comments.length, "comment")}
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
