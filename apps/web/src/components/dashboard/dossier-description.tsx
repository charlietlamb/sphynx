import { PROSE_CLASSES } from "@/components/layout/prose";
import { sanitizeGitHubHtml } from "@/components/layout/sanitize-html";

export function DossierDescription({ body }: { body: string }) {
  return (
    <div
      className={PROSE_CLASSES}
      dangerouslySetInnerHTML={{ __html: sanitizeGitHubHtml(body) }}
    />
  );
}
