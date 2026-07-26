import type { ReviewComment } from "@sphynx/schema/pull-request-comments";
import { Badge } from "@sphynx/ui/components/ui/badge";
import { cn } from "@sphynx/ui/lib/utils";
import { CommentBody } from "@/components/pull-request/comment-body";
import { ConversationCardHeader } from "@/components/pull-request/conversation-card-header";

interface CommentItemProps {
  comment: ReviewComment;
  originalLines: readonly string[];
  topBorder: boolean;
}

export function CommentItem({
  comment,
  originalLines,
  topBorder,
}: CommentItemProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2.5 p-3.5",
        topBorder && "border-border border-t"
      )}
    >
      <ConversationCardHeader
        at={comment.createdAt}
        author={comment.author}
        githubUrl={comment.githubUrl}
        now={Date.now()}
        verb={comment.pending ? <Badge variant="outline">Pending</Badge> : ""}
      />
      <CommentBody body={comment.body} originalLines={originalLines} />
    </div>
  );
}
