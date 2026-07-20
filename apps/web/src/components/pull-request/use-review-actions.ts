import type { PullRequestFile } from "@sphynx/schema/pull-requests";
import { type RefObject, useMemo } from "react";
import { toast } from "sonner";
import {
  type Handle,
  type ScrollPreset,
  scrollToLine,
} from "@/components/pull-request/code-view-scroll";
import {
  patchHunkStarts,
  patchLineText,
  patchNewLines,
  stepPatchLine,
} from "@/components/pull-request/patch-lines";
import type { PatchMap } from "@/components/pull-request/patch-map";
import {
  type DefinitionRef,
  trailKeyAt,
} from "@/components/pull-request/pull-request-search";
import type { ReviewKeyHandlers } from "@/components/pull-request/use-review-keys";
import type {
  CommentDraft,
  LineSelection,
  ReviewState,
  ReviewStore,
} from "@/components/pull-request/use-review-state";
import type { useSymbolHints } from "@/components/pull-request/use-symbol-hints";
import type {
  CursorPlacement,
  useTokenCursor,
} from "@/components/pull-request/use-token-cursor";
import { useSettings } from "@/components/settings/settings-provider";

const HALF_PAGE_LINES = 15;

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
  patches: PatchMap,
  path: string,
  direction: 1 | -1
) {
  const index = files.findIndex((candidate) => candidate.path === path);
  const adjacent = files[index + direction];
  const patch = adjacent ? patches.get(adjacent.path) : undefined;
  if (!(adjacent && patch)) {
    return null;
  }
  const lines = patchNewLines(patch);
  const line = direction === 1 ? lines[0] : lines.at(-1);
  if (line === undefined) {
    return null;
  }
  return { path: adjacent.path, line };
}

function moveDestination(
  files: readonly PullRequestFile[],
  patches: PatchMap,
  target: MoveTarget,
  direction: 1 | -1,
  confined = false
) {
  const { path, current, paneKey } = target;
  const patch = path ? patches.get(path) : undefined;
  if (!(path && patch)) {
    return null;
  }
  const stepped = stepPatchLine(patch, current, direction);
  if (stepped === null) {
    return null;
  }
  if (stepped !== current) {
    return { path, line: stepped };
  }
  if (paneKey || confined) {
    return null;
  }
  return adjacentFileTarget(files, patches, path, direction);
}

function selectionRange(selection: LineSelection) {
  return {
    start: Math.min(selection.start, selection.end),
    end: Math.max(selection.start, selection.end),
  };
}

function yankRange(state: ReviewState, target: MoveTarget) {
  const active =
    !target.paneKey && state.lineSelection?.path === target.path
      ? state.lineSelection
      : null;
  if (active) {
    return selectionRange(active);
  }
  return target.current === null
    ? null
    : { start: target.current, end: target.current };
}

function copyLines(
  path: string,
  range: { start: number; end: number },
  lines: readonly string[]
) {
  const reference =
    range.start === range.end
      ? `${path}:${range.start}`
      : `${path}:${range.start}-${range.end}`;
  navigator.clipboard
    .writeText(`${reference}\n${lines.join("\n")}`)
    .then(() =>
      toast.success(
        lines.length === 1 ? "Copied 1 line" : `Copied ${lines.length} lines`,
        { description: reference }
      )
    )
    .catch(() => toast.error("Couldn't copy to the clipboard"));
}

function mainSeedTarget(state: ReviewState, patches: PatchMap) {
  const entry = state.trail[0];
  if (entry?.anchorPath && entry.anchorLine !== null) {
    return { path: entry.anchorPath, line: entry.anchorLine };
  }
  const patch = state.path ? patches.get(state.path) : undefined;
  if (!(state.path && patch)) {
    return null;
  }
  const first = patchNewLines(patch)[0];
  return first === undefined ? null : { path: state.path, line: first };
}

function hopDestination(
  target: MoveTarget,
  state: ReviewState,
  patches: PatchMap
) {
  if (target.path && target.current !== null) {
    return { path: target.path, line: target.current };
  }
  return mainSeedTarget(state, patches);
}

interface ReviewActionsInput {
  columnHandle: (column: 0 | 1) => Handle;
  columnRefs: RefObject<(HTMLDivElement | null)[]>;
  cursor: ReturnType<typeof useTokenCursor>;
  files: readonly PullRequestFile[];
  focusColumn: (column: 0 | 1) => void;
  hints: ReturnType<typeof useSymbolHints>;
  patches: PatchMap;
  selectFile: (path: string) => void;
  setDraft: (draft: CommentDraft | null) => void;
  setLine: (path: string, line: number) => void;
  setLineSelection: (selection: LineSelection | null) => void;
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
  patches,
  selectFile,
  setDraft,
  setLine,
  setLineSelection,
  setPaneCursor,
  setTrail,
  setViewed,
  store,
  stepFile,
  toggleHelp,
  viewedFiles,
}: ReviewActionsInput): ReviewKeyHandlers {
  const { start: startHints, cancel: cancelHints, onKey: onHintKey } = hints;
  const { update: updateSettings } = useSettings();
  return useMemo(() => {
    const scope = () => columnRefs.current[store.read().focusedColumn];
    const applyMove = (
      target: MoveTarget,
      destination: { path: string; line: number } | null,
      preset: ScrollPreset = "nearest",
      at: CursorPlacement = "first"
    ) => {
      if (!destination) {
        return;
      }
      if (target.paneKey) {
        setPaneCursor(target.paneKey, destination.line);
      } else {
        setLine(destination.path, destination.line);
        const active = store.read().lineSelection;
        if (active && active.path === destination.path) {
          setLineSelection({ ...active, end: destination.line });
        }
      }
      scrollToLine(
        columnHandle(store.read().focusedColumn),
        destination.path,
        destination.line,
        preset
      );
      cursor.placeAt(scope(), at);
    };
    const targetPatch = (target: MoveTarget) =>
      (target.path ? patches.get(target.path) : undefined) ?? null;
    const selecting = () => store.read().lineSelection !== null;
    const clearSelection = () => {
      if (selecting()) {
        setLineSelection(null);
      }
    };
    const moveLine = (direction: 1 | -1, at: CursorPlacement = "first") => {
      const target = resolveMoveTarget(store.read());
      applyMove(
        target,
        moveDestination(files, patches, target, direction, selecting()),
        "nearest",
        at
      );
    };
    const hopColumn = (direction: 1 | -1) => {
      const state = store.read();
      const column = direction === 1 ? 1 : 0;
      if (column === state.focusedColumn || columnCountOf(state) < 2) {
        return;
      }
      focusColumn(column);
      const target = resolveMoveTarget(store.read());
      const destination = hopDestination(target, state, patches);
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
      onJumpEdge: (edge: 1 | -1) => {
        const target = resolveMoveTarget(store.read());
        const patch = targetPatch(target);
        if (!(target.path && patch)) {
          return;
        }
        const lines = patchNewLines(patch);
        const line = edge === -1 ? lines[0] : lines.at(-1);
        if (line !== undefined) {
          applyMove(
            target,
            { path: target.path, line },
            edge === -1 ? "top" : "end"
          );
        }
      },
      onMoveHunk: (direction: 1 | -1) => {
        const target = resolveMoveTarget(store.read());
        const patch = targetPatch(target);
        if (!(target.path && patch)) {
          return;
        }
        const starts = patchHunkStarts(patch);
        const current = target.current;
        const line =
          direction === 1
            ? starts.find((start) => current === null || start > current)
            : starts.findLast((start) => current !== null && start < current);
        if (line !== undefined) {
          applyMove(target, { path: target.path, line });
        }
      },
      onMovePage: (direction: 1 | -1) => {
        const target = resolveMoveTarget(store.read());
        const patch = targetPatch(target);
        if (!(target.path && patch)) {
          return;
        }
        const lines = patchNewLines(patch);
        const index =
          target.current === null ? -1 : lines.indexOf(target.current);
        const next =
          lines[
            Math.min(
              Math.max(index + direction * HALF_PAGE_LINES, 0),
              lines.length - 1
            )
          ];
        if (next !== undefined && next !== target.current) {
          applyMove(target, { path: target.path, line: next }, "center");
          return;
        }
        if (!(target.paneKey || selecting())) {
          applyMove(
            target,
            adjacentFileTarget(files, patches, target.path, direction),
            "center"
          );
        }
      },
      onAlignLine: (preset: "center" | "end" | "top") => {
        const state = store.read();
        const target = resolveMoveTarget(state);
        if (target.path && target.current !== null) {
          scrollToLine(
            columnHandle(state.focusedColumn),
            target.path,
            target.current,
            preset
          );
        }
      },
      onNextFile: () => {
        clearSelection();
        stepFile(1);
      },
      onPrevFile: () => {
        clearSelection();
        stepFile(-1);
      },
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
      onToggleVisual: () => {
        const state = store.read();
        if (!(focusedIsMain(state) && state.path)) {
          return;
        }
        if (state.lineSelection) {
          setLineSelection(null);
          return;
        }
        const patch = patches.get(state.path);
        const line =
          state.line ?? (patch ? patchNewLines(patch)[0] : undefined);
        if (line === undefined) {
          return;
        }
        if (state.line === null) {
          setLine(state.path, line);
        }
        setLineSelection({
          path: state.path,
          start: line,
          end: line,
          side: "additions",
        });
      },
      onYank: () => {
        const state = store.read();
        const target = resolveMoveTarget(state);
        const patch = targetPatch(target);
        const range = yankRange(state, target);
        if (!(target.path && patch && range)) {
          return;
        }
        const lines = patchLineText(patch, range.start, range.end);
        if (lines.length > 0) {
          copyLines(target.path, range, lines);
        }
        clearSelection();
      },
      onClearSelection: () => clearSelection(),
      onComment: () => {
        const state = store.read();
        if (viewedFiles === null) {
          return;
        }
        if (state.lineSelection) {
          const { start, end } = selectionRange(state.lineSelection);
          setDraft({
            path: state.lineSelection.path,
            line: end,
            startLine: start === end ? null : start,
            side: state.lineSelection.side,
          });
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
      onToggleSidebar: () =>
        updateSettings((previous) => ({
          sidebarCollapsed: !previous.sidebarCollapsed,
        })),
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
    patches,
    startHints,
    cancelHints,
    onHintKey,
    selectFile,
    setDraft,
    setLine,
    setLineSelection,
    setPaneCursor,
    setTrail,
    setViewed,
    store,
    stepFile,
    toggleHelp,
    updateSettings,
    viewedFiles,
  ]);
}
