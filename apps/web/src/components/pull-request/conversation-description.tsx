import type { PullRequestSummary } from "@sphynx/schema/pull-requests";
import { ConversationBody } from "@/components/pull-request/conversation-body";
import { ConversationCardHeader } from "@/components/pull-request/conversation-card-header";

interface ConversationDescriptionProps {
  descriptionHTML: string | null;
  now: number;
  summary: PullRequestSummary;
}

export function ConversationDescription({
  descriptionHTML,
  now,
  summary,
}: ConversationDescriptionProps) {
  const hasBody = Boolean(descriptionHTML || summary.body);
  return (
    <div className="flex flex-col gap-2.5 rounded-md border border-border bg-background p-3.5">
      <ConversationCardHeader
        at={summary.createdAt}
        author={summary.author}
        githubUrl={summary.githubUrl}
        now={now}
        verb="opened this pull request"
      />
      {hasBody ? (
        <ConversationBody
          body={summary.body ?? ""}
          bodyHTML={descriptionHTML}
        />
      ) : (
        <p className="text-[12px] text-muted-foreground/60">No description.</p>
      )}
    </div>
  );
}
