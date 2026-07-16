import { useCallback, useMemo, useRef, useState } from "react";
import {
  clickHintTarget,
  collectSymbolHints,
  type SymbolHintState,
} from "@/components/pull-request/symbol-hints";

export function useSymbolHints() {
  const [hints, setHintsState] = useState<SymbolHintState | null>(null);
  const hintsRef = useRef<SymbolHintState | null>(null);

  const setHints = useCallback((next: SymbolHintState | null) => {
    hintsRef.current = next;
    setHintsState(next ?? null);
  }, []);

  const start = useCallback(
    (scope: HTMLElement | null) => {
      const items = collectSymbolHints(scope);
      if (items.length > 0) {
        setHints({ items, buffer: "" });
      }
    },
    [setHints]
  );

  const cancel = useCallback(() => setHints(null), [setHints]);

  const isActive = useCallback(() => hintsRef.current !== null, []);

  const onKey = useCallback(
    (key: string) => {
      const current = hintsRef.current;
      if (!current) {
        return;
      }
      const buffer = current.buffer + key;
      const matches = current.items.filter((item) =>
        item.label.startsWith(buffer)
      );
      const exact = matches.find((item) => item.label === buffer);
      if (exact) {
        clickHintTarget(exact.element);
        setHints(null);
        return;
      }
      setHints(matches.length === 0 ? null : { items: current.items, buffer });
    },
    [setHints]
  );

  return useMemo(
    () => ({ hints, isActive, start, cancel, onKey }),
    [hints, isActive, start, cancel, onKey]
  );
}
