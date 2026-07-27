import { useCallback, useRef, useState } from "react";
import type { MosaicNode } from "react-mosaic-component";

export type PaneId = "rail" | "queue" | "dossier";

const STORAGE_KEY = "sphynx-dashboard-mosaic";

const PANES: PaneId[] = ["rail", "queue", "dossier"];

const DEFAULT_SPLITS: Record<PaneId, number> = {
  rail: 23,
  queue: 47,
  dossier: 30,
};

const DEFAULT_LAYOUT: MosaicNode<PaneId> = {
  type: "split",
  direction: "row",
  children: PANES,
  splitPercentages: PANES.map((p) => DEFAULT_SPLITS[p]),
};

function collectLeaves(node: MosaicNode<PaneId> | null, into: Set<PaneId>) {
  if (node === null) {
    return;
  }
  if (typeof node === "string" || typeof node === "number") {
    into.add(node as PaneId);
    return;
  }
  if (node.type === "tabs") {
    for (const tab of node.tabs) {
      into.add(tab);
    }
    return;
  }
  for (const child of node.children) {
    collectLeaves(child, into);
  }
}

/**
 * react-mosaic is controlled here: whatever it emits from a drop/resize is the
 * next value, and rejecting an update desyncs the library from our state (a pane
 * that was visually moved but not committed just disappears). So we never reject.
 * We accept the emitted tree, but guarantee it stays valid and complete: any pane
 * dropped out of the tree is re-appended to the root split, and a wholly empty
 * tree falls back to the default. This makes "lose a pane on drop" impossible.
 */
function repairLayout(node: MosaicNode<PaneId> | null): MosaicNode<PaneId> {
  if (node === null) {
    return DEFAULT_LAYOUT;
  }
  const present = new Set<PaneId>();
  collectLeaves(node, present);
  const missing = PANES.filter((p) => !present.has(p));
  if (missing.length === 0) {
    return node;
  }
  if (present.size === 0) {
    return DEFAULT_LAYOUT;
  }
  return {
    type: "split",
    direction: "row",
    children: [node, ...missing],
  };
}

function readStoredLayout(): MosaicNode<PaneId> {
  if (typeof window === "undefined") {
    return DEFAULT_LAYOUT;
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return DEFAULT_LAYOUT;
  }
  try {
    const parsed = JSON.parse(raw) as MosaicNode<PaneId> | null;
    return repairLayout(parsed);
  } catch {
    return DEFAULT_LAYOUT;
  }
}

const RESIZE_IDLE_MS = 120;

export function useMosaicLayout() {
  const [layout, setLayout] = useState<MosaicNode<PaneId>>(readStoredLayout);
  const [resizing, setResizing] = useState(false);
  const [arranging, setArranging] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearIdleTimer = useCallback(() => {
    if (idleTimer.current !== null) {
      clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
  }, []);

  const onChange = useCallback(
    (next: MosaicNode<PaneId> | null) => {
      setLayout(next ?? DEFAULT_LAYOUT);
      setResizing(true);
      clearIdleTimer();
      idleTimer.current = setTimeout(() => setResizing(false), RESIZE_IDLE_MS);
    },
    [clearIdleTimer]
  );

  const onRelease = useCallback(
    (next: MosaicNode<PaneId> | null) => {
      clearIdleTimer();
      setResizing(false);
      const repaired = repairLayout(next);
      setLayout(repaired);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(repaired));
      }
    },
    [clearIdleTimer]
  );

  const reset = useCallback(() => {
    setLayout(DEFAULT_LAYOUT);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const toggleArranging = useCallback(() => setArranging((on) => !on), []);

  return {
    arranging,
    layout,
    onChange,
    onRelease,
    reset,
    resizing,
    toggleArranging,
  };
}
