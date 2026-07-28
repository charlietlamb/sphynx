import type { ReviewComment } from "@sphynx/schema/pull-request-comments";
import { Badge } from "@sphynx/ui/components/ui/badge";
import { useState } from "react";
import { CommentBody } from "@/components/pull-request/comment-body";
import { ConversationCardHeader } from "@/components/pull-request/conversation-card-header";

interface CommentItemProps {
  comment: ReviewComment;
  originalLines: readonly string[];
}

export function CommentItem({ comment, originalLines }: CommentItemProps) {
  const [now] = useState(() => Date.now());
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <ConversationCardHeader
        at={comment.createdAt}
        author={comment.author}
        githubUrl={comment.githubUrl}
        now={now}
        verb={comment.pending ? <Badge variant="outline">Pending</Badge> : ""}
      />
      <CommentBody body={comment.body} originalLines={originalLines} />
    </div>
  );
}
