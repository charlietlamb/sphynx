import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  type DefinitionRef,
  trailKeyAt,
} from "@/components/pull-request/pull-request-search";

export type PaneCursors = Readonly<Record<string, number>>;

export type CommentSide = "additions" | "deletions";

export interface CommentDraft {
  line: number;
  path: string;
  side: CommentSide;
  startLine: number | null;
}

export interface LineSelection {
  end: number;
  path: string;
  side: CommentSide;
  start: number;
}

export interface ReviewState {
  draft: CommentDraft | null;
  focusedColumn: 0 | 1;
  helpOpen: boolean;
  line: number | null;
  lineSelection: LineSelection | null;
  paneCursors: PaneCursors;
  path: string | undefined;
  trail: readonly DefinitionRef[];
}

function createStore(initial: ReviewState) {
  let value = initial;
  return {
    read: () => value,
    write: (partial: Partial<ReviewState>) => {
      value = { ...value, ...partial };
    },
  };
}

export type ReviewStore = ReturnType<typeof createStore>;

function prunePaneCursors(
  cursors: PaneCursors,
  trail: readonly DefinitionRef[]
) {
  const validKeys = new Set(trail.map((_, depth) => trailKeyAt(trail, depth)));
  return Object.fromEntries(
    Object.entries(cursors).filter(([key]) => validKeys.has(key))
  );
}

interface ReviewStoreInput {
  line: number | null;
  onFocusChange: () => void;
  path: string | undefined;
  trail: readonly DefinitionRef[];
}

export function useReviewStore({
  line,
  onFocusChange,
  path,
  trail,
}: ReviewStoreInput) {
  const [rawFocusedColumn, setRawFocusedColumn] = useState<0 | 1>(0);
  const [paneCursors, setPaneCursors] = useState<PaneCursors>({});
  const [helpOpen, setHelpOpen] = useState(false);
  const [draft, setDraftState] = useState<CommentDraft | null>(null);
  const [lineSelection, setLineSelectionState] = useState<LineSelection | null>(
    null
  );
  const columnCount = trail.length === 0 ? 1 : 2;
  const focusedColumn: 0 | 1 = columnCount > 1 ? rawFocusedColumn : 0;

  const storeRef = useRef<ReviewStore | null>(null);
  storeRef.current ??= createStore({
    draft,
    focusedColumn,
    helpOpen,
    line,
    lineSelection,
    paneCursors,
    path,
    trail,
  });
  const store = storeRef.current;

  useLayoutEffect(() => {
    store.write({
      draft,
      focusedColumn,
      helpOpen,
      line,
      lineSelection,
      paneCursors,
      path,
      trail,
    });
  }, [
    store,
    draft,
    focusedColumn,
    helpOpen,
    line,
    lineSelection,
    paneCursors,
    path,
    trail,
  ]);

  const focusColumn = useCallback(
    (column: 0 | 1) => {
      if (store.read().focusedColumn === column) {
        return;
      }
      onFocusChange();
      store.write({ focusedColumn: column });
      setRawFocusedColumn(column === 1 ? 1 : 0);
    },
    [store, onFocusChange]
  );

  const setPaneCursor = useCallback(
    (key: string, nextLine: number) => {
      const next = { ...store.read().paneCursors, [key]: nextLine };
      store.write({ paneCursors: next });
      setPaneCursors(next);
    },
    [store]
  );

  const applyTrail = useCallback(
    (next: readonly DefinitionRef[], focus: 0 | 1) => {
      const pruned = prunePaneCursors(store.read().paneCursors, next);
      onFocusChange();
      store.write({ focusedColumn: focus, paneCursors: pruned, trail: next });
      setPaneCursors(pruned);
      setRawFocusedColumn(focus === 1 ? 1 : 0);
    },
    [store, onFocusChange]
  );

  const toggleHelp = useCallback(() => {
    const next = !store.read().helpOpen;
    store.write({ helpOpen: next });
    setHelpOpen(next);
  }, [store]);

  const setDraft = useCallback(
    (next: CommentDraft | null) => {
      store.write({ draft: next ?? null, lineSelection: null });
      setDraftState(next ?? null);
      setLineSelectionState(null);
    },
    [store]
  );

  const setLineSelection = useCallback(
    (next: LineSelection | null) => {
      store.write({ lineSelection: next ?? null });
      setLineSelectionState(next ?? null);
    },
    [store]
  );

  return {
    applyTrail,
    draft,
    focusColumn,
    focusedColumn,
    helpOpen,
    lineSelection,
    paneCursors,
    setDraft,
    setLineSelection,
    setPaneCursor,
    store,
    toggleHelp,
  };
}
