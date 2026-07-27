import { useCallback, useEffect, useState } from "react";

export type PaneId = "rail" | "queue" | "dossier";

const PANES: PaneId[] = ["rail", "queue", "dossier"];
const DEFAULT_SIZES: Record<PaneId, number> = {
  rail: 17,
  queue: 53,
  dossier: 30,
};
const ORDER_KEY = "sphynx-dashboard-order";
const SIZES_KEY = "sphynx-dashboard-sizes";

function isCompleteOrder(value: unknown): value is PaneId[] {
  return (
    Array.isArray(value) &&
    value.length === PANES.length &&
    PANES.every((pane) => value.includes(pane))
  );
}

function isDefaultOrder(order: PaneId[]): boolean {
  return (
    order.length === PANES.length &&
    order.every((pane, index) => pane === PANES[index])
  );
}

function isPaneSizes(value: unknown): value is Record<PaneId, number> {
  return (
    typeof value === "object" &&
    value !== null &&
    PANES.every(
      (pane) => typeof (value as Record<string, unknown>)[pane] === "number"
    )
  );
}

function isDefaultSizes(sizes: Record<PaneId, number>): boolean {
  return PANES.every((pane) => sizes[pane] === DEFAULT_SIZES[pane]);
}

function readStored<T>(
  key: string,
  guard: (value: unknown) => value is T,
  fallback: T
): T {
  if (typeof window === "undefined") {
    return fallback;
  }
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return guard(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Pane order + sizes for the dashboard, both keyed to pane identity so a pane
 * keeps its width across a reorder (react-resizable-panels' own autosave is
 * positional and would swap widths). Order and sizes each persist to their own
 * key, dropped when they match the default. Setters stay pure; the mirror to
 * storage lives in effects.
 */
export function usePaneOrder() {
  const [order, setOrder] = useState<PaneId[]>(() =>
    readStored(ORDER_KEY, isCompleteOrder, PANES)
  );
  const [sizes, setSizes] = useState<Record<PaneId, number>>(() =>
    readStored(SIZES_KEY, isPaneSizes, DEFAULT_SIZES)
  );
  const [arranging, setArranging] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (isDefaultOrder(order)) {
      window.localStorage.removeItem(ORDER_KEY);
    } else {
      window.localStorage.setItem(ORDER_KEY, JSON.stringify(order));
    }
  }, [order]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (isDefaultSizes(sizes)) {
      window.localStorage.removeItem(SIZES_KEY);
    } else {
      window.localStorage.setItem(SIZES_KEY, JSON.stringify(sizes));
    }
  }, [sizes]);

  const reorder = useCallback((next: PaneId[]) => {
    if (isCompleteOrder(next)) {
      setOrder(next);
    }
  }, []);

  const resize = useCallback((next: Record<PaneId, number>) => {
    if (isPaneSizes(next)) {
      setSizes(next);
    }
  }, []);

  const reset = useCallback(() => {
    setOrder(PANES);
    setSizes(DEFAULT_SIZES);
  }, []);

  const toggleArranging = useCallback(() => setArranging((on) => !on), []);

  return { arranging, order, reorder, reset, resize, sizes, toggleArranging };
}
