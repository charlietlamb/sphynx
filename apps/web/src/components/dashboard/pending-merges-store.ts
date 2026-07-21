import { useSyncExternalStore } from "react";
import {
  clearSettledMerges,
  markMerged,
  type PendingMerges,
  unmarkMerged,
} from "./pending-merges";

interface PullRef {
  readonly number: number;
  readonly owner: string;
  readonly repo: string;
}

interface OpenShape {
  readonly openPulls: readonly PullRef[];
}

interface PipelineShape {
  readonly repos: readonly OpenShape[];
}

let store: PendingMerges = {};
const listeners = new Set<() => void>();

function emit(next: PendingMerges) {
  store = next;
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Record a pull the client just merged so reads suppress it until the read
 * model reflects the merge. A merge is confirmed by GitHub before its webhook
 * materializes, so an eager refetch would otherwise resurrect it in the queue.
 */
export function recordMerged(ref: PullRef) {
  emit(markMerged(store, ref, Date.now()));
}

/** Undo a tombstone after the merge it optimistically hid failed on GitHub. */
export function forgetMerged(ref: PullRef) {
  const next = unmarkMerged(store, ref);
  if (next !== store) {
    emit(next);
  }
}

/**
 * Retire tombstones the given read data has already caught up with (or that
 * have outlived the safety window). Called after every read so a stale window
 * never suppresses a pull for longer than it takes the model to update.
 */
export function reconcilePendingMerges(pipeline: PipelineShape) {
  const next = clearSettledMerges(pipeline, store, Date.now());
  if (next !== store) {
    emit(next);
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => store;
const EMPTY: PendingMerges = {};
const getServerSnapshot = () => EMPTY;

export function usePendingMerges() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
