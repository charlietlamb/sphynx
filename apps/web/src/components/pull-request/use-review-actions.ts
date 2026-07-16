import type { PullRequestFile } from "@sphynx/schema/pull-requests";
import { type RefObject, useMemo } from "react";
import {
  type Handle,
  scrollToLine,
} from "@/components/pull-request/code-view-scroll";
import {
  patchNewLines,
  stepPatchLine,
} from "@/components/pull-request/patch-lines";
import {
  type DefinitionRef,
  trailKeyAt,
} from "@/components/pull-request/pull-request-search";
import type { ReviewKeyHandlers } from "@/components/pull-request/use-review-keys";
import type {
  CommentDraft,
  ReviewState,
  ReviewStore,
} from "@/components/pull-request/use-review-state";
import type { useSymbolHints } from "@/components/pull-request/use-symbol-hints";
import type {
  CursorPlacement,
  useTokenCursor,
} from "@/components/pull-request/use-token-cursor";

interface MoveTarget {
  current: number | null;
  paneKey: string | null;
  path: string | undefined;
}

function columnCountOf(state: ReviewState) {
  return state.trail.length === 0 ? 1 : 2;
}

function focusedIsMain(state: ReviewState) {
  return (
    state.trail.length === 0 ||
    (state.trail.length === 1 && state.focusedColumn === 0)
  );
}

function resolveMoveTarget(state: ReviewState): MoveTarget {
  if (focusedIsMain(state)) {
    return { path: state.path, current: state.line, paneKey: null };
  }
  const depth =
    state.trail.length === 1 || state.focusedColumn === 1
      ? state.trail.length - 1
      : state.trail.length - 2;
  const entry = state.trail[depth];
  const paneKey = trailKeyAt(state.trail, depth);
  const current = state.paneCursors[paneKey] ?? entry.line;
  return { path: entry.path, current, paneKey };
}

function adjacentFileTarget(
  files: readonly PullRequestFile[],
  path: string,
  direction: 1 | -1
) {
  const index = files.findIndex((candidate) => candidate.path === path);
  const adjacent = files[index + direction];
  if (!adjacent?.patch) {
    return null;
  }
  const lines = patchNewLines(adjacent.patch);
  const line = direction === 1 ? lines[0] : lines.at(-1);
  if (line === undefined) {
    return null;
  }
  return { path: adjacent.path, line };
}

function moveDestination(
  files: readonly PullRequestFile[],
  target: MoveTarget,
  direction: 1 | -1
) {
  const { path, current, paneKey } = target;
  const file = files.find((candidate) => candidate.path === path);
  if (!(path && file?.patch)) {
    return null;
  }
  const stepped = stepPatchLine(file.patch, current, direction);
  if (stepped === null) {
    return null;
  }
  if (stepped !== current) {
    return { path, line: stepped };
  }
  if (paneKey) {
    return null;
  }
  return adjacentFileTarget(files, path, direction);
}

function mainSeedTarget(state: ReviewState, files: readonly PullRequestFile[]) {
  const entry = state.trail[0];
  if (entry?.anchorPath && entry.anchorLine !== null) {
    return { path: entry.anchorPath, line: entry.anchorLine };
  }
  const target = files.find((candidate) => candidate.path === state.path);
  if (!(state.path && target?.patch)) {
    return null;
  }
  const first = patchNewLines(target.patch)[0];
  return first === undefined ? null : { path: state.path, line: first };
}

function hopDestination(
  target: MoveTarget,
  state: ReviewState,
  files: readonly PullRequestFile[]
) {
  if (target.path && target.current !== null) {
    return { path: target.path, line: target.current };
  }
  return mainSeedTarget(state, files);
}

interface ReviewActionsInput {
  columnHandle: (column: 0 | 1) => Handle;
  columnRefs: RefObject<(HTMLDivElement | null)[]>;
  cursor: ReturnType<typeof useTokenCursor>;
  files: readonly PullRequestFile[];
  focusColumn: (column: 0 | 1) => void;
  hints: ReturnType<typeof useSymbolHints>;
  selectFile: (path: string) => void;
  setDraft: (draft: CommentDraft | null) => void;
  setLine: (path: string, line: number) => void;
  setPaneCursor: (key: string, line: number) => void;
  setTrail: (next: DefinitionRef[] | null) => void;
  setViewed: (change: { path: string; viewed: boolean }) => void;
  stepFile: (direction: 1 | -1) => void;
  store: ReviewStore;
  toggleHelp: () => void;
  viewedFiles: ReadonlySet<string> | null;
}

export function useReviewActions({
  columnHandle,
  columnRefs,
  cursor,
  files,
  focusColumn,
  hints,
  selectFile,
  setDraft,
  setLine,
  setPaneCursor,
  setTrail,
  setViewed,
  store,
  stepFile,
  toggleHelp,
  viewedFiles,
}: ReviewActionsInput): ReviewKeyHandlers {
  const { start: startHints, cancel: cancelHints, onKey: onHintKey } = hints;
  return useMemo(() => {
    const scope = () => columnRefs.current[store.read().focusedColumn];
    const moveLine = (direction: 1 | -1, at: CursorPlacement = "first") => {
      const state = store.read();
      const target = resolveMoveTarget(state);
      const destination = moveDestination(files, target, direction);
      if (!destination) {
        return;
      }
      if (target.paneKey) {
        setPaneCursor(target.paneKey, destination.line);
      } else {
        setLine(destination.path, destination.line);
      }
      scrollToLine(
        columnHandle(state.focusedColumn),
        destination.path,
        destination.line,
        "nearest"
      );
      cursor.placeAt(scope(), at);
    };
    const hopColumn = (direction: 1 | -1) => {
      const state = store.read();
      const column = direction === 1 ? 1 : 0;
      if (column === state.focusedColumn || columnCountOf(state) < 2) {
        return;
      }
      focusColumn(column);
      const target = resolveMoveTarget(store.read());
      const destination = hopDestination(target, state, files);
      if (destination) {
        if (!target.paneKey && state.line === null) {
          setLine(destination.path, destination.line);
        }
        scrollToLine(
          columnHandle(column),
          destination.path,
          destination.line,
          "nearest"
        );
      }
      cursor.placeAt(
        columnRefs.current[column],
        direction === 1 ? "first" : "last"
      );
    };
    return {
      onMoveLine: (direction: 1 | -1) => moveLine(direction),
      onNextFile: () => stepFile(1),
      onPrevFile: () => stepFile(-1),
      onPopTrail: () => {
        const { trail } = store.read();
        setTrail(trail.length > 1 ? trail.slice(0, -1) : null);
      },
      onCloseTrail: () => {
        if (store.read().trail.length > 0) {
          setTrail(null);
        }
      },
      onFocusColumn: (column: 0 | 1) => {
        const state = store.read();
        const target = column === 1 && columnCountOf(state) > 1 ? 1 : 0;
        if (target === state.focusedColumn) {
          return;
        }
        focusColumn(target);
        cursor.placeAt(columnRefs.current[target], "first");
      },
      onMoveSymbol: (direction: 1 | -1) => {
        if (cursor.move(scope(), direction) === "edge") {
          hopColumn(direction);
        }
      },
      onMoveWord: (direction: 1 | -1) => {
        if (cursor.moveWord(scope(), direction) === "edge") {
          moveLine(direction, direction === 1 ? "first" : "last");
        }
      },
      onMoveWordEnd: () => {
        if (cursor.moveWordEnd(scope()) === "edge") {
          moveLine(1, "chunk-end");
        }
      },
      onOpenSymbol: () => cursor.open(scope()),
      onJumpToCallSite: () => {
        const state = store.read();
        const entry = state.trail.at(-1);
        if (!entry?.anchorPath || entry.anchorLine === null) {
          return;
        }
        scrollToLine(
          columnHandle(0),
          entry.anchorPath,
          entry.anchorLine,
          "anchor"
        );
        focusColumn(0);
        if (state.trail.length >= 2) {
          const depth = state.trail.length - 2;
          setPaneCursor(trailKeyAt(state.trail, depth), entry.anchorLine);
        } else {
          setLine(entry.anchorPath, entry.anchorLine);
        }
        cursor.placeAt(columnRefs.current[0], "first");
      },
      onMarkViewed: () => {
        const state = store.read();
        if (viewedFiles === null) {
          return;
        }
        if (!focusedIsMain(state)) {
          const target = resolveMoveTarget(state);
          if (target.path) {
            setViewed({
              path: target.path,
              viewed: !viewedFiles.has(target.path),
            });
          }
          return;
        }
        if (!state.path) {
          return;
        }
        setViewed({ path: state.path, viewed: true });
        const index = files.findIndex(
          (candidate) => candidate.path === state.path
        );
        const next = files
          .slice(index + 1)
          .find((candidate) => !viewedFiles.has(candidate.path));
        if (next) {
          selectFile(next.path);
        }
      },
      onComment: () => {
        const state = store.read();
        if (viewedFiles === null) {
          return;
        }
        if (!(focusedIsMain(state) && state.path && state.line !== null)) {
          return;
        }
        setDraft({
          path: state.path,
          line: state.line,
          startLine: null,
          side: "additions",
        });
      },
      onCancelDraft: () => setDraft(null),
      onToggleHelp: toggleHelp,
      onStartHints: () => startHints(scope()),
      onCancelHints: cancelHints,
      onHintKey,
    };
  }, [
    columnHandle,
    columnRefs,
    cursor,
    files,
    focusColumn,
    startHints,
    cancelHints,
    onHintKey,
    selectFile,
    setDraft,
    setLine,
    setPaneCursor,
    setTrail,
    setViewed,
    store,
    stepFile,
    toggleHelp,
    viewedFiles,
  ]);
}
