import DOMPurify from "dompurify";

export function sanitizeGitHubHtml(html: string) {
  if (typeof window === "undefined") {
    return html;
  }
  return DOMPurify.sanitize(html);
}
