import type { WorkbenchEventKind } from "@sphynx/schema/workbench";

const KINDS = new Set<WorkbenchEventKind>([
  "pr-opened",
  "pr-merged",
  "pr-closed",
  "pr-reopened",
  "pr-ready",
  "review-approved",
  "review-changes",
  "review-commented",
  "comment",
  "push",
  "branch-created",
  "branch-deleted",
  "release",
]);

/** Narrow a stored feed-event kind string to the typed union, or null. */
export function toWorkbenchKind(value: string): WorkbenchEventKind | null {
  return KINDS.has(value as WorkbenchEventKind)
    ? (value as WorkbenchEventKind)
    : null;
}
