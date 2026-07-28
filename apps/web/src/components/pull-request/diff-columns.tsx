import type { ReviewThread } from "@sphynx/schema/pull-request-comments";
import type {
  PullRequestFile,
  PullRequestRef,
} from "@sphynx/schema/pull-requests";
import { cn } from "@sphynx/ui/lib/utils";
import { DiffCardList } from "@/components/pull-request/diff-card-list";
import { PaneColumn } from "@/components/pull-request/pane-column";
import type {
  PatchMap,
  SymbolIndex,
} from "@/components/pull-request/patch-map";
import type { DefinitionRef } from "@/components/pull-request/pull-request-search";
import { trailKeyAt } from "@/components/pull-request/pull-request-search";
import type { ReviewCommenting } from "@/components/pull-request/use-review-comments";
import type { useReviewNavigation } from "@/components/pull-request/use-review-navigation";

type ReviewNavigation = ReturnType<typeof useReviewNavigation>;

interface DiffColumnsProps {
  commenting: ReviewCommenting;
  files: readonly PullRequestFile[];
  focusColumn: (column: 0 | 1) => void;
  focusedColumn: 0 | 1;
  headSha: string;
  navigation: ReviewNavigation;
  onSelectMain: (path: string, line: number, token?: HTMLElement) => void;
  onSelectPane: (index: number, line: number, token?: HTMLElement) => void;
  onSetViewed: (change: { path: string; viewed: boolean }) => void;
  paneCursors: Record<string, number | undefined>;
  patches: PatchMap;
  pullRequestRef: PullRequestRef;
  setColumnRef: (column: 0 | 1, node: HTMLDivElement | null) => void;
  showMain: boolean;
  symbolIndex: SymbolIndex;
  threads: readonly ReviewThread[];
  trail: readonly DefinitionRef[];
  viewedFiles: ReadonlySet<string> | null;
  visiblePanes: readonly number[];
}

export function DiffColumns({
  commenting,
  files,
  focusColumn,
  focusedColumn,
  headSha,
  navigation,
  onSelectMain,
  onSelectPane,
  onSetViewed,
  paneCursors,
  patches,
  pullRequestRef,
  setColumnRef,
  showMain,
  symbolIndex,
  threads,
  trail,
  viewedFiles,
  visiblePanes,
}: DiffColumnsProps) {
  const columnCount = showMain ? 1 + visiblePanes.length : visiblePanes.length;
  return (
    <div
      className="grid size-full min-h-0 min-w-0 gap-2.5"
      style={{
        gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
        gridTemplateRows: "minmax(0, 1fr)",
      }}
    >
      <div
        className={cn(
          "isolate min-h-0 min-w-0 flex-col overflow-hidden",
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
          focused={focusedColumn === 0}
          handleRef={navigation.attachMain}
          headSha={headSha}
          onNavigate={navigation.openTrail}
          onSelectLine={onSelectMain}
          onSetViewed={onSetViewed}
          patches={patches}
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
            onClose={() =>
              navigation.setTrail(depth === 0 ? null : trail.slice(0, depth))
            }
            onFocus={focusColumn}
            onNavigate={navigation.navigateFrom}
            onSelectPosition={onSelectPane}
            onSetViewed={onSetViewed}
            patches={patches}
            pullRequestRef={pullRequestRef}
            symbolIndex={symbolIndex}
            viewedFiles={viewedFiles}
          />
        );
      })}
    </div>
  );
}
