import type { QueuePull, ThreadPreview } from "@sphynx/schema/review-queue";
import { stripBotSuffix } from "@/lib/claims";

const SEVERITY_PATTERN = /^(P[0-3])\b[:\s]*/;

export function splitSeverity(body: string) {
  const match = SEVERITY_PATTERN.exec(body);
  if (!match?.[1]) {
    return { severity: null, text: body };
  }
  return { severity: match[1], text: body.slice(match[0].length) };
}

function severityRank(preview: ThreadPreview) {
  const { severity } = splitSeverity(preview.body);
  return severity ? Number(severity.slice(1)) : 4;
}

export function orderedThreadPreviews(pull: QueuePull) {
  return [...pull.threadPreviews].sort(
    (a, b) => severityRank(a) - severityRank(b)
  );
}

export function unresolvedThreadsText(pull: QueuePull) {
  const lines = orderedThreadPreviews(pull).map((preview, index) => {
    const author = preview.author
      ? stripBotSuffix(preview.author.login)
      : "unknown";
    const location = preview.path ? ` in ${preview.path}` : "";
    return `${index + 1}. ${author}${location}:\n${preview.body}`;
  });
  const missing = pull.unresolvedThreads - pull.threadPreviews.length;
  const footer =
    missing > 0
      ? `\n${missing} more unresolved threads: https://github.com/${pull.owner}/${pull.repo}/pull/${pull.number}`
      : "";
  return `Unresolved review threads on ${pull.owner}/${pull.repo}#${pull.number} (${pull.title}):\n\n${lines.join("\n\n")}${footer}`;
}
