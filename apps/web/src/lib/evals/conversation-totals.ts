import type { EvalJournalEntry } from "@anpord/schema/domain/eval-trial";
import { stepFailed } from "@/lib/evals/conversation";

export interface ConversationTotals {
  readonly commands: number;
  readonly failed: number;
  readonly files: number;
  readonly toolCalls: number;
  readonly turns: number;
}

export const countConversation = (
  trajectory: readonly EvalJournalEntry[],
  files: readonly string[]
): ConversationTotals => ({
  commands: trajectory.filter((entry) => entry._tag === "command").length,
  failed: trajectory.filter(
    (entry) =>
      (entry._tag === "command" || entry._tag === "toolCall") &&
      stepFailed(entry)
  ).length,
  files: files.length,
  toolCalls: trajectory.filter((entry) => entry._tag === "toolCall").length,
  turns: trajectory.filter(
    (entry) => entry._tag === "message" && entry.role === "user"
  ).length,
});

export const writtenPaths = (
  artifacts: readonly { readonly path: string }[],
  changed: readonly string[]
) => [...new Set([...artifacts.map((file) => file.path), ...changed])];
