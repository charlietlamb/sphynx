import { cn } from "@sphynx/ui/lib/utils";
import { PROSE_CLASSES } from "@/components/layout/prose";
import { sanitizeGitHubHtml } from "@/components/layout/sanitize-html";
import { CommentMarkdown } from "@/components/pull-request/comment-markdown";

interface ConversationBodyProps {
  body: string;
  bodyHTML: string | null;
  className?: string;
}

const READING = "text-[13px] text-foreground/90 leading-relaxed";

export function ConversationBody({
  body,
  bodyHTML,
  className,
}: ConversationBodyProps) {
  if (bodyHTML !== null && bodyHTML !== "") {
    return (
      <div
        className={cn(PROSE_CLASSES, READING, className)}
        dangerouslySetInnerHTML={{ __html: sanitizeGitHubHtml(bodyHTML) }}
      />
    );
  }
  return (
    <div className={cn("min-w-0 [overflow-wrap:anywhere]", READING, className)}>
      <CommentMarkdown text={body} />
    </div>
  );
}
