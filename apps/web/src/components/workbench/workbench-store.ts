import { useMemo, useSyncExternalStore } from "react";
import type {
  MergedWorkbenchEvent,
  WorkbenchKind,
} from "@/components/workbench/workbench-copy";

interface StoredWorkbenchEvent extends MergedWorkbenchEvent {
  readonly owner: string;
  readonly repo: string;
}

interface WorkbenchStoreState {
  readonly events: readonly StoredWorkbenchEvent[];
  readonly lastSeenAt: number;
}

let state: WorkbenchStoreState = { events: [], lastSeenAt: Date.now() };
const listeners = new Set<() => void>();
let counter = 0;

function emit(next: WorkbenchStoreState) {
  state = next;
  for (const listener of listeners) {
    listener();
  }
}

export interface LogWorkbenchInput {
  detail?: string | null;
  kind: WorkbenchKind;
  owner: string;
  pull?: { number: number; title: string } | null;
  repo: string;
}

export function logWorkbenchEvent(input: LogWorkbenchInput) {
  counter += 1;
  const event: StoredWorkbenchEvent = {
    id: `sphynx-${counter}`,
    at: new Date().toISOString(),
    actor: null,
    kind: input.kind,
    pull: input.pull ?? null,
    detail: input.detail ?? null,
    url: null,
    source: "sphynx",
    owner: input.owner,
    repo: input.repo,
  };
  emit({ ...state, events: [event, ...state.events] });
}

export function markWorkbenchSeen() {
  emit({ ...state, lastSeenAt: Date.now() });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => state;
const SERVER_STATE: WorkbenchStoreState = { events: [], lastSeenAt: 0 };
const getServerSnapshot = () => SERVER_STATE;

export function useWorkbenchStore(owner: string, repo: string) {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
  const events = useMemo(
    () =>
      snapshot.events.filter(
        (event) => event.owner === owner && event.repo === repo
      ),
    [snapshot.events, owner, repo]
  );
  return { events, lastSeenAt: snapshot.lastSeenAt };
}
