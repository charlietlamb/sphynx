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
    <div className="flex min-w-0 flex-col gap-1.5">
      <ConversationCardHeader
        at={comment.createdAt}
        author={comment.author}
        githubUrl={comment.githubUrl}
        now={now}
        showAvatar={false}
        verb="commented"
      />
      <ConversationBody body={comment.body} bodyHTML={comment.bodyHTML} />
    </div>
  );
}
