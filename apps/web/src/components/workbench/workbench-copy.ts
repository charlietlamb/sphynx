import type { WorkbenchEvent } from "@sphynx/schema/workbench";

type WorkbenchSource = "github" | "sphynx";

export type WorkbenchKind = WorkbenchEvent["kind"] | "thread-resolved";

export interface MergedWorkbenchEvent {
  readonly actor: { login: string; avatarUrl: string | null } | null;
  readonly at: string;
  readonly detail: string | null;
  readonly id: string;
  readonly kind: WorkbenchKind;
  readonly pull: { number: number; title: string } | null;
  readonly source: WorkbenchSource;
  readonly url: string | null;
}

export type WorkbenchFilter =
  | "all"
  | "pulls"
  | "reviews"
  | "comments"
  | "pushes"
  | "yours";

export const WORKBENCH_FILTERS: readonly {
  label: string;
  value: WorkbenchFilter;
}[] = [
  { value: "all", label: "All" },
  { value: "pulls", label: "Pulls" },
  { value: "reviews", label: "Reviews" },
  { value: "comments", label: "Comments" },
  { value: "pushes", label: "Pushes" },
  { value: "yours", label: "Yours" },
];

export const WORKBENCH_VERBS: Record<WorkbenchKind, string> = {
  "pr-opened": "opened",
  "pr-merged": "merged",
  "pr-closed": "closed",
  "pr-reopened": "reopened",
  "pr-ready": "marked ready",
  "review-approved": "approved",
  "review-changes": "requested changes on",
  "review-commented": "reviewed",
  comment: "commented on",
  push: "pushed to",
  "branch-created": "created branch",
  "branch-deleted": "deleted branch",
  release: "released",
  "thread-resolved": "resolved a thread on",
};

export const WORKBENCH_GLYPHS: Record<WorkbenchKind, string> = {
  "pr-merged": "bg-addition",
  "review-approved": "bg-addition",
  "pr-closed": "bg-deletion",
  "review-changes": "bg-deletion",
  "pr-opened": "bg-primary",
  "pr-reopened": "bg-primary",
  "pr-ready": "bg-primary",
  release: "bg-primary",
  "review-commented": "bg-foreground/20",
  comment: "bg-foreground/20",
  "thread-resolved": "bg-foreground/20",
  push: "bg-foreground/20",
  "branch-created": "bg-foreground/20",
  "branch-deleted": "bg-foreground/20",
};

const FILTER_KINDS: Record<
  Exclude<WorkbenchFilter, "all" | "yours">,
  ReadonlySet<WorkbenchKind>
> = {
  pulls: new Set([
    "pr-opened",
    "pr-merged",
    "pr-closed",
    "pr-reopened",
    "pr-ready",
  ]),
  reviews: new Set(["review-approved", "review-changes", "review-commented"]),
  comments: new Set(["comment", "thread-resolved"]),
  pushes: new Set(["push", "branch-created", "branch-deleted", "release"]),
};

export function actorLabel(event: MergedWorkbenchEvent) {
  if (event.source === "sphynx") {
    return "you";
  }
  return event.actor?.login ?? "someone";
}

export function filterWorkbenchEvents(
  events: readonly MergedWorkbenchEvent[],
  filter: WorkbenchFilter,
  search: string
): readonly MergedWorkbenchEvent[] {
  const needle = search.trim().toLowerCase();
  return events.filter((event) => {
    if (filter === "yours" && event.source !== "sphynx") {
      return false;
    }
    if (
      filter !== "all" &&
      filter !== "yours" &&
      !FILTER_KINDS[filter].has(event.kind)
    ) {
      return false;
    }
    if (!needle) {
      return true;
    }
    const haystack = [
      event.actor?.login,
      event.pull ? `#${event.pull.number}` : null,
      event.pull?.title,
      event.detail,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
}
