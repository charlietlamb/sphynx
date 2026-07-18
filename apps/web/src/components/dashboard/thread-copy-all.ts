import type { QueuePull } from "@sphynx/schema/review-queue";
import { stripBotSuffix } from "@/lib/claims";

export function unresolvedThreadsText(pull: QueuePull) {
  const lines = pull.threadPreviews.map((preview, index) => {
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
