import type { CodeViewHandle } from "@pierre/diffs/react";
import type {
  PullRequestFile,
  PullRequestRef,
} from "@sphynx/schema/pull-requests";
import { useCallback, useRef } from "react";
import { DefinitionPane } from "@/components/pull-request/definition-pane";
import type { DefinitionRef } from "@/components/pull-request/pull-request-search";
import type { SymbolIndex } from "@/components/pull-request/symbol-index";
import { useActiveDiffContainer } from "@/components/pull-request/use-active-diff-container";

interface PaneColumnProps {
  column: 0 | 1;
  columnRef: (column: 0 | 1, node: HTMLDivElement | null) => void;
  cursorLine?: number;
  depth: number;
  entry: DefinitionRef;
  file: PullRequestFile;
  focused: boolean;
  headSha: string;
  onAttach: (index: number, handle: CodeViewHandle<undefined> | null) => void;
  onClose: () => void;
  onFocus: (column: 0 | 1) => void;
  onNavigate: (index: number, definition: DefinitionRef) => void;
  onSelectPosition: (index: number, line: number, token?: HTMLElement) => void;
  onSetViewed: (change: { path: string; viewed: boolean }) => void;
  pullRequestRef: PullRequestRef;
  symbolIndex: SymbolIndex;
  viewedFiles: ReadonlySet<string> | null;
}

export function PaneColumn({
  column,
  columnRef,
  cursorLine,
  depth,
  entry,
  file,
  focused,
  headSha,
  onAttach,
  onClose,
  onFocus,
  onNavigate,
  onSelectPosition,
  onSetViewed,
  pullRequestRef,
  symbolIndex,
  viewedFiles,
}: PaneColumnProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  useActiveDiffContainer(wrapperRef, focused ? file.path : null);
  const attachWrapper = useCallback(
    (node: HTMLDivElement | null) => {
      wrapperRef.current = node;
      columnRef(column, node);
    },
    [columnRef, column]
  );
  return (
    <div
      className="isolate h-full min-w-0"
      onPointerDown={() => onFocus(column)}
      ref={attachWrapper}
    >
      <DefinitionPane
        cursorLine={cursorLine}
        file={file}
        headSha={headSha}
        index={depth}
        line={entry.line}
        onAttach={onAttach}
        onClose={onClose}
        onNavigate={onNavigate}
        onSelectPosition={onSelectPosition}
        onSetViewed={onSetViewed}
        pullRequestRef={pullRequestRef}
        symbolIndex={symbolIndex}
        viewedFiles={viewedFiles}
      />
    </div>
  );
}
