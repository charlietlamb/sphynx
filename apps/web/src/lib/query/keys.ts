import type { PullRequestRef } from "@sphynx/schema/pull-requests";

interface RepoRef {
  readonly owner: string;
  readonly repo: string;
}

/**
 * Action-backed query keys nest identity outward-in so invalidation can use a
 * prefix. Convex subscriptions bring their own generated keys.
 *
 * Keys carry identity only. A freshness signal must never become part of a key:
 * it mints a new cache entry on every change, which is what made
 * `invalidateQueries` silently do nothing on the dashboard.
 */
export const keys = {
  all: ["gh"] as const,

  installations: () => [...keys.all, "installations"] as const,
  installation: (id: number | null) =>
    [...keys.all, "installation", id] as const,
  search: (id: number | null, query: string) =>
    [...keys.installation(id), "search", query] as const,

  repo: (ref: RepoRef) => [...keys.all, "repo", ref.owner, ref.repo] as const,
  repoEvents: (ref: RepoRef, id: number | null) =>
    [...keys.repo(ref), "events", id] as const,

  pull: (ref: PullRequestRef) =>
    [...keys.repo(ref), "pull", ref.number] as const,
  pullSummary: (ref: PullRequestRef) => [...keys.pull(ref), "summary"] as const,
  pullBody: (ref: PullRequestRef) => [...keys.pull(ref), "body"] as const,
  pullPatches: (ref: PullRequestRef) => [...keys.pull(ref), "patches"] as const,
  pullConversation: (ref: PullRequestRef) =>
    [...keys.pull(ref), "conversation"] as const,
  pullThreads: (ref: PullRequestRef) => [...keys.pull(ref), "threads"] as const,
  pullPendingReview: (ref: PullRequestRef) =>
    [...keys.pull(ref), "pending-review"] as const,
  pullViewedFiles: (ref: PullRequestRef) =>
    [...keys.pull(ref), "viewed-files"] as const,
  /** Content-addressed by sha, which is why it can be cached indefinitely. */
  pullFileContents: (
    ref: PullRequestRef,
    sha: string,
    path: string | undefined
  ) => [...keys.pull(ref), "file-contents", sha, path] as const,

  mirroredTheme: (light: string | undefined, dark: string | undefined) =>
    [...keys.all, "mirrored-theme", light, dark] as const,
} as const;
