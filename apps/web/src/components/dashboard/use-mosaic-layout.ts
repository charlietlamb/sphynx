import { useCallback, useState } from "react";
import type { MosaicNode } from "react-mosaic-component";

export type PaneId = "rail" | "queue" | "dossier";

const STORAGE_KEY = "sphynx-dashboard-mosaic";

const PANES: PaneId[] = ["rail", "queue", "dossier"];

export const DEFAULT_SPLITS: Record<PaneId, number> = {
  rail: 17,
  queue: 53,
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

function isCompleteLayout(node: MosaicNode<PaneId> | null): boolean {
  const leaves = new Set<PaneId>();
  collectLeaves(node, leaves);
  return leaves.size === PANES.length && PANES.every((p) => leaves.has(p));
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
    return isCompleteLayout(parsed)
      ? (parsed as MosaicNode<PaneId>)
      : DEFAULT_LAYOUT;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function useMosaicLayout() {
  const [layout, setLayout] = useState<MosaicNode<PaneId>>(readStoredLayout);

  const onChange = useCallback((next: MosaicNode<PaneId> | null) => {
    if (!isCompleteLayout(next)) {
      return;
    }
    setLayout(next as MosaicNode<PaneId>);
  }, []);

  const onRelease = useCallback((next: MosaicNode<PaneId> | null) => {
    if (!isCompleteLayout(next) || typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const reset = useCallback(() => {
    setLayout(DEFAULT_LAYOUT);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return { layout, onChange, onRelease, reset };
}
