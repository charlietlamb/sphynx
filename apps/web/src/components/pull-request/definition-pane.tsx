import { getSingularPatch } from "@pierre/diffs";
import { CodeView, type CodeViewHandle } from "@pierre/diffs/react";
import type {
  PullRequestFile,
  PullRequestRef,
} from "@sphynx/schema/pull-requests";
import { cn } from "@sphynx/ui/lib/utils";
import { useCallback, useMemo } from "react";
import { scrollToLine } from "@/components/pull-request/code-view-scroll";
import { CARD_CLASSES } from "@/components/pull-request/diff-card-classes";
import { DiffCardHeader } from "@/components/pull-request/diff-card-header";
import {
  enrichWithContents,
  expandableFilePath,
} from "@/components/pull-request/full-contents";
import { definitionScrollLine } from "@/components/pull-request/patch-lines";
import type {
  PatchMap,
  SymbolIndex,
} from "@/components/pull-request/patch-map";
import {
  toGitPatch,
  useFileContents,
} from "@/components/pull-request/pull-request-queries";
import type { DefinitionRef } from "@/components/pull-request/pull-request-search";
import { useDiffSymbolOptions } from "@/components/pull-request/use-diff-symbol-options";

const PANE_LAYOUT = { paddingTop: 0, paddingBottom: 8, gap: 0 };

interface DefinitionPaneProps {
  cursorLine?: number;
  file: PullRequestFile;
  headSha: string;
  index: number;
  line: number;
  onAttach: (index: number, handle: CodeViewHandle<undefined> | null) => void;
  onClose: () => void;
  onNavigate: (index: number, definition: DefinitionRef) => void;
  onSelectPosition: (index: number, line: number, token?: HTMLElement) => void;
  onSetViewed: (change: { path: string; viewed: boolean }) => void;
  patches: PatchMap;
  pullRequestRef: PullRequestRef;
  symbolIndex: SymbolIndex;
  viewedFiles: ReadonlySet<string> | null;
}

export function DefinitionPane({
  cursorLine,
  file,
  headSha,
  index,
  line,
  onAttach,
  onClose,
  onNavigate,
  onSelectPosition,
  onSetViewed,
  patches,
  pullRequestRef,
  symbolIndex,
  viewedFiles,
}: DefinitionPaneProps) {
  const navigate = useCallback(
    (definition: DefinitionRef) => onNavigate(index, definition),
    [onNavigate, index]
  );
  const selectLine = useCallback(
    (_path: string, selectedLine: number, token?: HTMLElement) =>
      onSelectPosition(index, selectedLine, token),
    [onSelectPosition, index]
  );
  const symbolOptions = useDiffSymbolOptions({
    onNavigate: navigate,
    onSelectLine: selectLine,
    symbolIndex,
  });
  const options = useMemo(
    () => ({ ...symbolOptions, layout: PANE_LAYOUT }),
    [symbolOptions]
  );

  const viewed = viewedFiles?.has(file.path) ?? false;
  const renderCustomHeader = useCallback(
    (item: { id: string }) => (
      <DiffCardHeader
        additions={file.additions}
        deletions={file.deletions}
        onClose={onClose}
        onViewedChange={(next) => onSetViewed({ path: item.id, viewed: next })}
        path={item.id}
        viewed={viewedFiles?.has(item.id) ?? false}
        viewedDisabled={viewedFiles === null}
      />
    ),
    [file.additions, file.deletions, onClose, onSetViewed, viewedFiles]
  );

  const contents = useFileContents(
    pullRequestRef,
    headSha,
    expandableFilePath(file)
  );
  const patch = patches.get(file.path) ?? null;
  const fileDiff = useMemo(() => {
    const base = getSingularPatch(toGitPatch(file, patch));
    return contents ? enrichWithContents(base, contents) : base;
  }, [file, patch, contents]);
  const items = useMemo(
    () => [
      {
        id: file.path,
        type: "diff" as const,
        fileDiff,
        version: Number(viewed) + (contents ? 2 : 0),
      },
    ],
    [fileDiff, file.path, viewed, contents]
  );

  const selectedLines = useMemo(() => {
    const highlighted = cursorLine ?? line;
    return {
      id: file.path,
      range: {
        start: highlighted,
        end: highlighted,
        side: "additions" as const,
      },
    };
  }, [file.path, line, cursorLine]);

  const attachHandle = useCallback(
    (handle: CodeViewHandle<undefined> | null) => {
      onAttach(index, handle);
      const target = patch ? definitionScrollLine(patch, line) : line;
      scrollToLine(handle, file.path, target, "top");
    },
    [onAttach, index, patch, file.path, line]
  );

  return (
    <CodeView
      className={cn(
        "h-full min-w-0 overflow-y-auto overscroll-contain outline-none",
        CARD_CLASSES
      )}
      items={items}
      options={options}
      ref={attachHandle}
      renderCustomHeader={renderCustomHeader}
      selectedLines={selectedLines}
    />
  );
}
