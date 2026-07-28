import { useCallback, useState } from "react";
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

/**
 * A legitimate pane never goes below react-mosaic's `minimumPaneSizePercentage`
 * (12%), so any split under this epsilon can only be the drag-start `hide()`
 * collapse artifact — never a real user layout.
 */
const COLLAPSE_EPSILON = 3;

/**
 * True if any split in the tree collapses a pane to (near) 0%. On window-drag
 * start react-mosaic defers `hide(path)`, which emits exactly this: the dragged
 * pane collapsed to a 0/100 split. Applying it shrinks the drag-source overlay's
 * box to zero mid-dragstart, and Chrome aborts the whole drag on frame one
 * (dragstart → dragend, no dragover — react-dnd #1085/#2177). So we never apply
 * a collapsed tree; the pane stays full-size and the drag survives. The real
 * committed layout arrives on `onRelease`.
 */
function hasCollapsedSplit(node: MosaicNode<PaneId> | null): boolean {
  if (node === null || typeof node === "string" || typeof node === "number") {
    return false;
  }
  if (node.type === "tabs") {
    return false;
  }
  if (
    node.splitPercentages?.some((percentage) => percentage < COLLAPSE_EPSILON)
  ) {
    return true;
  }
  return node.children.some(hasCollapsedSplit);
}

export function useMosaicLayout() {
  const [layout, setLayout] = useState<MosaicNode<PaneId>>(readStoredLayout);
  const [arranging, setArranging] = useState(false);

  const onChange = useCallback((next: MosaicNode<PaneId> | null) => {
    if (hasCollapsedSplit(next)) {
      return;
    }
    setLayout(next ?? DEFAULT_LAYOUT);
  }, []);

  const onRelease = useCallback((next: MosaicNode<PaneId> | null) => {
    const repaired = repairLayout(next);
    setLayout(repaired);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(repaired));
    }
  }, []);

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
    toggleArranging,
  };
}
