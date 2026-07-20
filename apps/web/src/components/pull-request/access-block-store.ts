import type { PullRequestRef } from "@sphynx/schema/pull-requests";
import { useSyncExternalStore } from "react";

/**
 * Records that GitHub refused a write because the app cannot reach the repo.
 *
 * This is UI state, not server state. It previously lived in the query cache
 * behind an `enabled: false` query written via `setQueryData`, which meant the
 * banner silently disappeared once the entry was garbage collected.
 */
const blocked = new Map<string, string>();
const listeners = new Set<() => void>();

const keyOf = (ref: PullRequestRef) => `${ref.owner}/${ref.repo}#${ref.number}`;

const emit = () => {
  for (const listener of listeners) {
    listener();
  }
};

export const recordAccessBlock = (ref: PullRequestRef, message: string) => {
  blocked.set(keyOf(ref), message);
  emit();
};

export function useAccessBlock(ref: PullRequestRef) {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => blocked.get(keyOf(ref)) ?? null,
    () => null
  );
}
