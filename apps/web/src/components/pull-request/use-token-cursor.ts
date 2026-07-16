import { useCallback, useEffect, useMemo, useRef } from "react";
import { clickHintTarget } from "@/components/pull-request/symbol-hints";

const CURSOR_ATTRIBUTE = "data-token-cursor";
const WATCH_WINDOW_MS = 1500;

export type CursorPlacement = "chunk-end" | "first" | "last";
export type CursorMoveResult = "edge" | "moved" | "none";

type SettleTarget = number | "chunk-end" | "last";

function selectedRows(scope: HTMLElement | null) {
  const rows: Element[] = [];
  if (!scope) {
    return rows;
  }
  for (const container of scope.querySelectorAll("diffs-container")) {
    const selected = container.shadowRoot?.querySelectorAll(
      "[data-selected-line]"
    );
    rows.push(...(selected ?? []));
  }
  return rows;
}

function rowTokens(row: Element) {
  const tokens: HTMLElement[] = [];
  for (const span of row.querySelectorAll<HTMLElement>("span[data-char]")) {
    if ((span.textContent ?? "").trim() !== "") {
      tokens.push(span);
    }
  }
  return tokens;
}

function lineChunks(scope: HTMLElement | null) {
  const chunks: HTMLElement[][] = [];
  for (const row of selectedRows(scope)) {
    let chunk: HTMLElement[] = [];
    for (const span of row.querySelectorAll<HTMLElement>("span[data-char]")) {
      if ((span.textContent ?? "").trim() === "") {
        if (chunk.length > 0) {
          chunks.push(chunk);
        }
        chunk = [];
      } else {
        chunk.push(span);
      }
    }
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
  }
  return chunks;
}

function lineTokens(scope: HTMLElement | null) {
  return lineChunks(scope).flat();
}

function targetIndex(tokens: HTMLElement[], at: SettleTarget) {
  if (at === "last") {
    return tokens.length - 1;
  }
  if (at === "chunk-end") {
    return 0;
  }
  return Math.min(at, tokens.length - 1);
}

function resolveTarget(scope: HTMLElement | null, at: SettleTarget) {
  const chunks = lineChunks(scope);
  const tokens = chunks.flat();
  if (tokens.length === 0) {
    return null;
  }
  if (at === "chunk-end") {
    const token = chunks[0]?.at(-1) ?? tokens[0];
    return { token, index: tokens.indexOf(token) };
  }
  const index = targetIndex(tokens, at);
  return { token: tokens[index], index };
}

function shadowHost(element: HTMLElement) {
  const root = element.getRootNode();
  return root instanceof ShadowRoot ? root.host : element;
}

export function useTokenCursor() {
  const activeRef = useRef<HTMLElement | null>(null);
  const desiredRef = useRef<SettleTarget | null>(null);
  const generationRef = useRef(0);

  const unstamp = useCallback(() => {
    activeRef.current?.removeAttribute(CURSOR_ATTRIBUTE);
    activeRef.current = null;
  }, []);

  const stamp = useCallback(
    (token: HTMLElement) => {
      unstamp();
      token.setAttribute(CURSOR_ATTRIBUTE, "");
      activeRef.current = token;
    },
    [unstamp]
  );

  const watch = useCallback(
    (scope: HTMLElement | null) => {
      const generation = generationRef.current;
      const deadline = performance.now() + WATCH_WINDOW_MS;
      const tick = () => {
        if (generationRef.current !== generation) {
          return;
        }
        const active = activeRef.current;
        const stampedOnSelection =
          active?.isConnected && active.closest("[data-selected-line]");
        if (!stampedOnSelection && desiredRef.current !== null) {
          const resolved = resolveTarget(scope, desiredRef.current);
          if (resolved) {
            stamp(resolved.token);
            desiredRef.current = resolved.index;
          }
        }
        if (performance.now() < deadline) {
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);
    },
    [stamp]
  );

  const clear = useCallback(() => {
    generationRef.current += 1;
    desiredRef.current = null;
    unstamp();
  }, [unstamp]);

  const setIntent = useCallback(
    (scope: HTMLElement | null, token: HTMLElement, index: number) => {
      generationRef.current += 1;
      stamp(token);
      desiredRef.current = index;
      watch(scope);
    },
    [stamp, watch]
  );

  const liveIndex = useCallback((tokens: HTMLElement[]) => {
    const active = activeRef.current;
    if (active?.isConnected) {
      const index = tokens.indexOf(active);
      if (index !== -1) {
        return index;
      }
    }
    const desired = desiredRef.current;
    if (desired === null) {
      return active ? 0 : null;
    }
    return targetIndex(tokens, desired);
  }, []);

  const move = useCallback(
    (scope: HTMLElement | null, direction: 1 | -1): CursorMoveResult => {
      const tokens = lineTokens(scope);
      if (tokens.length === 0) {
        return "none";
      }
      const index = liveIndex(tokens);
      if (index === null) {
        const seed = direction === 1 ? 0 : tokens.length - 1;
        setIntent(scope, tokens[seed], seed);
        return "moved";
      }
      const next = index + direction;
      if (next < 0 || next >= tokens.length) {
        setIntent(scope, tokens[index], index);
        return "edge";
      }
      setIntent(scope, tokens[next], next);
      return "moved";
    },
    [liveIndex, setIntent]
  );

  const moveWord = useCallback(
    (scope: HTMLElement | null, direction: 1 | -1): CursorMoveResult => {
      const chunks = lineChunks(scope);
      const tokens = chunks.flat();
      if (chunks.length === 0) {
        return "none";
      }
      const index = liveIndex(tokens);
      if (index === null) {
        const chunk = direction === 1 ? chunks[0] : chunks.at(-1);
        const token = chunk?.[0];
        if (!token) {
          return "none";
        }
        setIntent(scope, token, tokens.indexOf(token));
        return "moved";
      }
      const token = tokens[index];
      const chunkIndex = chunks.findIndex((chunk) => chunk.includes(token));
      const backWithinChunk =
        direction === -1 && chunks[chunkIndex]?.[0] !== token;
      const target = backWithinChunk
        ? chunks[chunkIndex][0]
        : chunks[chunkIndex + direction]?.[0];
      if (!target) {
        setIntent(scope, token, index);
        return "edge";
      }
      setIntent(scope, target, tokens.indexOf(target));
      return "moved";
    },
    [liveIndex, setIntent]
  );

  const moveWordEnd = useCallback(
    (scope: HTMLElement | null): CursorMoveResult => {
      const chunks = lineChunks(scope);
      const tokens = chunks.flat();
      if (chunks.length === 0) {
        return "none";
      }
      const index = liveIndex(tokens);
      const token = index === null ? null : tokens[index];
      const chunkIndex = token
        ? chunks.findIndex((chunk) => chunk.includes(token))
        : -1;
      const target =
        chunkIndex === -1 || chunks[chunkIndex].at(-1) !== token
          ? chunks[Math.max(chunkIndex, 0)]?.at(-1)
          : chunks[chunkIndex + 1]?.at(-1);
      if (!target) {
        if (token && index !== null) {
          setIntent(scope, token, index);
        }
        return "edge";
      }
      setIntent(scope, target, tokens.indexOf(target));
      return "moved";
    },
    [liveIndex, setIntent]
  );

  const placeAt = useCallback(
    (scope: HTMLElement | null, at: CursorPlacement) => {
      generationRef.current += 1;
      unstamp();
      desiredRef.current = at === "first" ? 0 : at;
      watch(scope);
    },
    [unstamp, watch]
  );

  const place = useCallback(
    (scope: HTMLElement | null, token: HTMLElement) => {
      generationRef.current += 1;
      stamp(token);
      const row = token.closest("[data-line]");
      const index = row ? rowTokens(row).indexOf(token) : -1;
      desiredRef.current = index === -1 ? 0 : index;
      watch(scope);
    },
    [stamp, watch]
  );

  const open = useCallback(
    (scope: HTMLElement | null) => {
      const active = activeRef.current;
      if (!(active?.isConnected && active.hasAttribute("data-symbol"))) {
        return;
      }
      if (scope && !scope.contains(shadowHost(active))) {
        return;
      }
      clickHintTarget(active);
      clear();
    },
    [clear]
  );

  useEffect(() => clear, [clear]);

  return useMemo(
    () => ({ clear, move, moveWord, moveWordEnd, open, place, placeAt }),
    [clear, move, moveWord, moveWordEnd, open, place, placeAt]
  );
}
