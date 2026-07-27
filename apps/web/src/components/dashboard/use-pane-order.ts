import { useCallback, useEffect, useState } from "react";

export type PaneId = "rail" | "queue" | "dossier";

const PANES: PaneId[] = ["rail", "queue", "dossier"];
const ORDER_KEY = "sphynx-dashboard-order";

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

function readStoredOrder(): PaneId[] {
  if (typeof window === "undefined") {
    return PANES;
  }
  const raw = window.localStorage.getItem(ORDER_KEY);
  if (!raw) {
    return PANES;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isCompleteOrder(parsed) ? parsed : PANES;
  } catch {
    return PANES;
  }
}

/**
 * Pane order for the dashboard: a flat, always-complete `PaneId[]` (no tree, no
 * collapse edge cases). Reorder/reset stay pure state setters; the order is
 * mirrored to storage in an effect, and a reset also drops the panel-sizes key.
 */
export function usePaneOrder() {
  const [order, setOrder] = useState<PaneId[]>(readStoredOrder);
  const [arranging, setArranging] = useState(false);

  // Mirror the committed order to storage; the default order clears the key.
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

  const reorder = useCallback((next: PaneId[]) => {
    if (isCompleteOrder(next)) {
      setOrder(next);
    }
  }, []);

  const reset = useCallback(() => setOrder(PANES), []);

  const toggleArranging = useCallback(() => setArranging((on) => !on), []);

  return { arranging, order, reorder, reset, toggleArranging };
}
