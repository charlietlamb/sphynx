import { cn } from "@sphynx/ui/lib/utils";
import { PROSE_CLASSES } from "@/components/layout/prose";
import { sanitizeGitHubHtml } from "@/components/layout/sanitize-html";
import { CommentMarkdown } from "@/components/pull-request/comment-markdown";

interface ConversationBodyProps {
  body: string;
  bodyHTML: string | null;
  className?: string;
}

export function ConversationBody({
  body,
  bodyHTML,
  className,
}: ConversationBodyProps) {
  if (bodyHTML !== null && bodyHTML !== "") {
    return (
      <div
        className={cn(PROSE_CLASSES, className)}
        dangerouslySetInnerHTML={{ __html: sanitizeGitHubHtml(bodyHTML) }}
      />
    );
  }
  return (
    <div className={cn("text-[12px] leading-snug", className)}>
      <CommentMarkdown text={body} />
    </div>
  );
}
