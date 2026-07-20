import type {
  ConversationReview,
  ConversationVerdict,
} from "@sphynx/schema/pull-request-conversation";
import { ConversationBody } from "@/components/pull-request/conversation-body";
import { ConversationCardHeader } from "@/components/pull-request/conversation-card-header";
import { VerdictIcon } from "@/components/pull-request/verdict-icon";
import { plural } from "@/lib/claims";

const VERDICT_LABELS: Record<ConversationVerdict, string> = {
  approved: "approved these changes",
  "changes-requested": "requested changes",
  commented: "reviewed",
  dismissed: "reviewed (dismissed)",
};

interface ConversationReviewCardProps {
  now: number;
  review: ConversationReview;
}

export function ConversationReviewCard({
  now,
  review,
}: ConversationReviewCardProps) {
  const hasBody = review.body.trim() !== "";
  return (
    <div className="flex flex-col gap-2.5 rounded-md border border-border bg-background p-3.5">
      <ConversationCardHeader
        at={review.submittedAt}
        author={review.author}
        githubUrl={review.githubUrl}
        now={now}
        verb={
          <span className="flex items-center gap-1.5">
            <VerdictIcon verdict={review.verdict} />
            {VERDICT_LABELS[review.verdict]}
          </span>
        }
      />
      {hasBody ? (
        <ConversationBody body={review.body} bodyHTML={review.bodyHTML} />
      ) : null}
      {review.commentCount > 0 ? (
        <p className="text-[11px] text-muted-foreground/60">
          {plural(review.commentCount, "review comment")}
        </p>
      ) : null}
    </div>
  );
}
