import type { ConversationComment } from "@sphynx/schema/pull-request-conversation";
import { ConversationBody } from "@/components/pull-request/conversation-body";
import { ConversationCardHeader } from "@/components/pull-request/conversation-card-header";

interface ConversationCommentCardProps {
  comment: ConversationComment;
  now: number;
}

export function ConversationCommentCard({
  comment,
  now,
}: ConversationCommentCardProps) {
  return (
    <div className="flex flex-col gap-2.5 rounded-md border border-border bg-background p-3.5">
      <ConversationCardHeader
        at={comment.createdAt}
        author={comment.author}
        githubUrl={comment.githubUrl}
        now={now}
        verb="commented"
      />
      <ConversationBody body={comment.body} bodyHTML={comment.bodyHTML} />
    </div>
  );
}
