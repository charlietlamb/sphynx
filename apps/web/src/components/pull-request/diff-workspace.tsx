import type {
  PullRequestFile,
  PullRequestRef,
} from "@sphynx/schema/pull-requests";
import { cn } from "@sphynx/ui/lib/utils";
import { useCallback, useMemo, useRef } from "react";
import { DefinitionTrailBar } from "@/components/pull-request/definition-trail-bar";
import { DiffCardList } from "@/components/pull-request/diff-card-list";
import { DiffWorkerPool } from "@/components/pull-request/diff-worker-pool";
import { FileList } from "@/components/pull-request/file-list";
import { PaneColumn } from "@/components/pull-request/pane-column";
import {
  useCommentThreads,
  useViewedFiles,
} from "@/components/pull-request/pull-request-queries";
import {
  EMPTY_TRAIL,
  trailKeyAt,
  usePullRequestSearch,
} from "@/components/pull-request/pull-request-search";
import { ReviewHelp } from "@/components/pull-request/review-help";
import { ReviewSubmit } from "@/components/pull-request/review-submit";
import { SymbolHintOverlay } from "@/components/pull-request/symbol-hint-overlay";
import type { SymbolIndex } from "@/components/pull-request/symbol-index";
import { useReviewActions } from "@/components/pull-request/use-review-actions";
import { useReviewComments } from "@/components/pull-request/use-review-comments";
import { useReviewKeys } from "@/components/pull-request/use-review-keys";
import { useReviewNavigation } from "@/components/pull-request/use-review-navigation";
import { useReviewStore } from "@/components/pull-request/use-review-state";
import { useSymbolHints } from "@/components/pull-request/use-symbol-hints";
import { useTokenCursor } from "@/components/pull-request/use-token-cursor";
import { ViewedProgress } from "@/components/pull-request/viewed-progress";

interface DiffWorkspaceProps {
  files: readonly PullRequestFile[];
  headSha: string;
  pullRequestRef: PullRequestRef;
  symbolIndex: SymbolIndex;
}

export default function DiffWorkspace({
  files,
  headSha,
  pullRequestRef,
  symbolIndex,
}: DiffWorkspaceProps) {
  const [{ file, line, panes }, setSearch] = usePullRequestSearch();
  const { viewedFiles, setViewed, setAllViewed } =
    useViewedFiles(pullRequestRef);
  const threads = useCommentThreads(pullRequestRef);
  const trail = useMemo(() => {
    const known = new Set(files.map((candidate) => candidate.path));
    const entries = (panes ?? EMPTY_TRAIL).filter((entry) =>
      known.has(entry.path)
    );
    return entries.length === (panes ?? EMPTY_TRAIL).length
      ? (panes ?? EMPTY_TRAIL)
      : entries;
  }, [panes, files]);
  const columnRefs = useRef<(HTMLDivElement | null)[]>([null, null]);
  const hints = useSymbolHints();
  const cursor = useTokenCursor();
  const knownFile = files.some((candidate) => candidate.path === file)
    ? file
    : null;
  const currentPath = knownFile ?? files[0]?.path;

  const {
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
  } = useReviewStore({
    line,
    onFocusChange: cursor.clear,
    path: currentPath,
    trail,
  });

  const commenting = useReviewComments({
    canComment: viewedFiles !== null,
    draft,
    headSha,
    lineSelection,
    ref: pullRequestRef,
    setDraft,
    setLineSelection,
  });

  const navigation = useReviewNavigation({
    applyTrail,
    file,
    files,
    line,
    setSearch,
    store,
  });

  const showMain = trail.length < 2;
  let visiblePanes: number[] = [];
  if (trail.length === 1) {
    visiblePanes = [0];
  } else if (trail.length >= 2) {
    visiblePanes = [trail.length - 2, trail.length - 1];
  }
  const columnCount = showMain ? 1 + visiblePanes.length : visiblePanes.length;

  const setColumnRef = useCallback(
    (column: 0 | 1, node: HTMLDivElement | null) => {
      columnRefs.current[column] = node;
    },
    []
  );

  const isHelpOpen = useCallback(() => store.read().helpOpen, [store]);

  const clearCollapsedLine = useCallback(() => {
    if (store.read().line === null) {
      return;
    }
    store.write({ line: null });
    setSearch({ line: null }, { history: "replace" });
  }, [store, setSearch]);

  const markViewed = useCallback(
    (change: { path: string; viewed: boolean }) => {
      if (change.viewed && change.path === store.read().path) {
        clearCollapsedLine();
      }
      setViewed(change);
    },
    [setViewed, store, clearCollapsedLine]
  );

  const markAllViewed = useCallback(() => {
    clearCollapsedLine();
    setAllViewed(files.map((candidate) => candidate.path));
  }, [setAllViewed, files, clearCollapsedLine]);

  const placeCursor = useCallback(
    (column: 0 | 1, token?: HTMLElement) => {
      const scope = columnRefs.current[column];
      if (token) {
        cursor.place(scope, token);
      } else {
        cursor.placeAt(scope, "first");
      }
    },
    [cursor]
  );

  const { setLine } = navigation;
  const selectMainPosition = useCallback(
    (path: string, nextLine: number, token?: HTMLElement) => {
      setLine(path, nextLine);
      placeCursor(0, token);
    },
    [setLine, placeCursor]
  );

  const selectPanePosition = useCallback(
    (index: number, nextLine: number, token?: HTMLElement) => {
      const { trail: currentTrail } = store.read();
      setPaneCursor(trailKeyAt(currentTrail, index), nextLine);
      const column: 0 | 1 =
        currentTrail.length < 2 || index === currentTrail.length - 1 ? 1 : 0;
      placeCursor(column, token);
    },
    [store, setPaneCursor, placeCursor]
  );

  const handlers = useReviewActions({
    columnHandle: navigation.columnHandle,
    columnRefs,
    cursor,
    files,
    focusColumn,
    hints,
    selectFile: navigation.selectFile,
    setDraft,
    setLine: navigation.setLine,
    setPaneCursor,
    setTrail: navigation.setTrail,
    setViewed: markViewed,
    stepFile: navigation.stepFile,
    store,
    toggleHelp,
    viewedFiles,
  });

  const isDraftOpen = useCallback(() => store.read().draft !== null, [store]);
  useReviewKeys({
    handlers,
    isDraftOpen,
    isHelpOpen,
    isHintsActive: hints.isActive,
  });

  return (
    <DiffWorkerPool>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
        {trail.length > 0 || viewedFiles ? (
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              {trail.length > 0 ? (
                <DefinitionTrailBar
                  onBack={handlers.onPopTrail}
                  onClose={handlers.onCloseTrail}
                  onTruncate={(index) =>
                    navigation.setTrail(trail.slice(0, index + 1))
                  }
                  trail={trail}
                />
              ) : null}
            </div>
            {viewedFiles ? (
              <ViewedProgress
                total={files.length}
                viewed={
                  files.filter((candidate) => viewedFiles.has(candidate.path))
                    .length
                }
              />
            ) : null}
            {commenting.pendingReview.pendingId ? (
              <ReviewSubmit
                onDiscard={commenting.discardReview}
                onSubmit={commenting.submitReview}
                pendingReview={commenting.pendingReview}
                submitting={commenting.submitting}
              />
            ) : null}
          </div>
        ) : null}
        <div className="flex min-h-0 min-w-0 flex-1 gap-5">
          <aside className="h-full w-64 shrink-0">
            <FileList
              files={files}
              onMarkAllViewed={markAllViewed}
              onSelect={navigation.selectFile}
              selectedPath={currentPath}
              viewedFiles={viewedFiles}
            />
          </aside>
          <div
            className="grid min-h-0 min-w-0 flex-1 gap-4"
            style={{
              gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
              gridTemplateRows: "minmax(0, 1fr)",
            }}
          >
            <div
              className={cn(
                "isolate max-h-full min-w-0 flex-col self-start overflow-hidden",
                showMain ? "flex" : "hidden"
              )}
              onPointerDown={() => focusColumn(0)}
              ref={(node) => {
                if (showMain) {
                  setColumnRef(0, node);
                }
              }}
            >
              <DiffCardList
                commenting={commenting}
                files={files}
                handleRef={navigation.attachMain}
                headSha={headSha}
                onNavigate={navigation.openTrail}
                onSelectLine={selectMainPosition}
                onSetViewed={markViewed}
                pullRequestRef={pullRequestRef}
                symbolIndex={symbolIndex}
                threads={threads}
                viewedFiles={viewedFiles}
              />
            </div>
            {visiblePanes.map((depth, order) => {
              const entry = trail[depth];
              const paneFile = files.find(
                (candidate) => candidate.path === entry.path
              );
              if (!paneFile) {
                return null;
              }
              const column: 0 | 1 = showMain || order === 1 ? 1 : 0;
              const trailKey = trailKeyAt(trail, depth);
              return (
                <PaneColumn
                  column={column}
                  columnRef={setColumnRef}
                  cursorLine={paneCursors[trailKey]}
                  depth={depth}
                  entry={entry}
                  file={paneFile}
                  focused={focusedColumn === column}
                  headSha={headSha}
                  key={trailKey}
                  onAttach={navigation.attachPane}
                  onFocus={focusColumn}
                  onNavigate={navigation.navigateFrom}
                  onSelectPosition={selectPanePosition}
                  onSetViewed={markViewed}
                  pullRequestRef={pullRequestRef}
                  symbolIndex={symbolIndex}
                  viewedFiles={viewedFiles}
                />
              );
            })}
          </div>
        </div>
        {hints.hints ? (
          <SymbolHintOverlay
            buffer={hints.hints.buffer}
            items={hints.hints.items}
          />
        ) : null}
        {helpOpen ? <ReviewHelp /> : null}
      </div>
    </DiffWorkerPool>
  );
}
