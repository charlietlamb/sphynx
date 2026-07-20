import { getSingularPatch } from "@pierre/diffs";
import { CodeView, type CodeViewHandle } from "@pierre/diffs/react";
import type { ReviewThread } from "@sphynx/schema/pull-request-comments";
import type {
  PullRequestFile,
  PullRequestRef,
} from "@sphynx/schema/pull-requests";
import { cn } from "@sphynx/ui/lib/utils";
import { type Ref, useCallback, useMemo, useRef } from "react";
import { CommentComposer } from "@/components/pull-request/comment-composer";
import { CommentThread } from "@/components/pull-request/comment-thread";
import { CARD_CLASSES } from "@/components/pull-request/diff-card-classes";
import {
  enrichWithContents,
  expandableFilePath,
} from "@/components/pull-request/full-contents";
import { patchLineText } from "@/components/pull-request/patch-lines";
import type {
  PatchMap,
  SymbolIndex,
} from "@/components/pull-request/patch-map";
import {
  toGitPatch,
  useFileContents,
} from "@/components/pull-request/pull-request-queries";
import type { DefinitionRef } from "@/components/pull-request/pull-request-search";
import { usePullRequestSearch } from "@/components/pull-request/pull-request-search";
import { renderFileTypePrefix } from "@/components/pull-request/render-file-type-prefix";
import { useActiveDiffContainer } from "@/components/pull-request/use-active-diff-container";
import { useDiffSymbolOptions } from "@/components/pull-request/use-diff-symbol-options";
import type { ReviewCommenting } from "@/components/pull-request/use-review-comments";
import { useViewedHeader } from "@/components/pull-request/use-viewed-header";

const CARD_LAYOUT = { paddingTop: 0, paddingBottom: 8, gap: 16 };

function threadKey(path: string, line: number, side: string) {
  return `${path}|${line}|${side}`;
}

interface CardAnnotation {
  lineNumber: number;
  side: "additions" | "deletions";
}

function cardAnnotations(
  path: string,
  threads: readonly ReviewThread[],
  draft: ReviewCommenting["draft"]
) {
  const annotations: CardAnnotation[] = [];
  for (const thread of threads) {
    if (thread.path === path) {
      annotations.push({ side: thread.side, lineNumber: thread.line });
    }
  }
  const draftHere =
    draft?.path === path &&
    !annotations.some(
      (annotation) =>
        annotation.lineNumber === draft.line && annotation.side === draft.side
    );
  if (draftHere && draft) {
    annotations.push({ side: draft.side, lineNumber: draft.line });
  }
  return annotations;
}

function annotationStamp(annotations: readonly CardAnnotation[]) {
  return annotations.reduce(
    (hash, annotation) =>
      (hash * 31 +
        annotation.lineNumber * 2 +
        Number(annotation.side === "deletions")) %
      65_536,
    annotations.length
  );
}

interface DiffCardListProps {
  commenting: ReviewCommenting;
  files: readonly PullRequestFile[];
  focused: boolean;
  handleRef: Ref<CodeViewHandle<undefined>>;
  headSha: string;
  onNavigate: (definition: DefinitionRef) => void;
  onSelectLine: (path: string, line: number, token?: HTMLElement) => void;
  onSetViewed: (change: { path: string; viewed: boolean }) => void;
  patches: PatchMap;
  pullRequestRef: PullRequestRef;
  symbolIndex: SymbolIndex;
  threads: readonly ReviewThread[];
  viewedFiles: ReadonlySet<string> | null;
}

export function DiffCardList({
  commenting,
  files,
  focused,
  handleRef,
  headSha,
  onNavigate,
  onSelectLine,
  onSetViewed,
  patches,
  pullRequestRef,
  symbolIndex,
  threads,
  viewedFiles,
}: DiffCardListProps) {
  const [{ file, line }] = usePullRequestSearch();
  const rootRef = useRef<HTMLDivElement>(null);
  const fallbackPath = file ?? files[0]?.path;
  const activePath = focused ? (fallbackPath ?? null) : null;
  useActiveDiffContainer(rootRef, activePath);
  const { canComment, changeSelection, openDraft } = commenting;
  const commentingCallbacks = useMemo(
    () =>
      canComment
        ? { onOpenDraft: openDraft, onSelectionChange: changeSelection }
        : undefined,
    [canComment, openDraft, changeSelection]
  );
  const symbolOptions = useDiffSymbolOptions({
    commenting: commentingCallbacks,
    onNavigate,
    onSelectLine,
    symbolIndex,
  });

  const fileDiffs = useMemo(
    () =>
      files.map((changedFile) => ({
        path: changedFile.path,
        fileDiff: getSingularPatch(
          toGitPatch(changedFile, patches.get(changedFile.path) ?? null)
        ),
      })),
    [files, patches]
  );

  const threadsByKey = useMemo(() => {
    const grouped = new Map<string, ReviewThread[]>();
    for (const thread of threads) {
      const key = threadKey(thread.path, thread.line, thread.side);
      grouped.set(key, [...(grouped.get(key) ?? []), thread]);
    }
    return grouped;
  }, [threads]);

  const expandablePath = expandableFilePath(
    files.find((candidate) => candidate.path === fallbackPath)
  );
  const activeContents = useFileContents(
    pullRequestRef,
    headSha,
    expandablePath
  );

  const { draft } = commenting;
  const items = useMemo(
    () =>
      fileDiffs.map(({ path, fileDiff }) => {
        const viewed = viewedFiles?.has(path) ?? false;
        const annotations = cardAnnotations(path, threads, draft);
        const enriched = path === expandablePath ? activeContents : null;
        return {
          id: path,
          type: "diff" as const,
          fileDiff: enriched
            ? enrichWithContents(fileDiff, enriched)
            : fileDiff,
          collapsed: viewed,
          version:
            Number(viewed) +
            (draft?.path === path ? 2 : 0) +
            (enriched ? 4 : 0) +
            annotationStamp(annotations) * 8,
          annotations,
        };
      }),
    [fileDiffs, viewedFiles, threads, draft, expandablePath, activeContents]
  );

  const options = useMemo(
    () => ({ ...symbolOptions, stickyHeaders: true, layout: CARD_LAYOUT }),
    [symbolOptions]
  );

  const { selection } = commenting;
  const selectedLines = useMemo(() => {
    if (draft) {
      return {
        id: draft.path,
        range: {
          start: draft.startLine ?? draft.line,
          end: draft.line,
          side: draft.side,
        },
      };
    }
    if (selection) {
      return {
        id: selection.path,
        range: {
          start: selection.start,
          end: selection.end,
          side: selection.side,
        },
      };
    }
    if (file === null || line === null) {
      return null;
    }
    return {
      id: file,
      range: { start: line, end: line, side: "additions" as const },
    };
  }, [draft, selection, file, line]);

  const lineText = useCallback(
    (path: string, start: number, end: number) => {
      const patch = patches.get(path);
      return patch ? patchLineText(patch, start, end) : [];
    },
    [patches]
  );

  const { cancelDraft, creating, submitDraft } = commenting;
  const renderAnnotation = useCallback(
    (
      annotation: { side: string; lineNumber: number },
      item: { id: string }
    ) => {
      const key = threadKey(item.id, annotation.lineNumber, annotation.side);
      const isDraftSite =
        draft?.path === item.id &&
        draft.line === annotation.lineNumber &&
        draft.side === annotation.side;
      return (
        <>
          {threadsByKey.get(key)?.map((thread) => (
            <CommentThread
              commenting={commenting}
              key={thread.comments[0]?.id ?? thread.line}
              originalLines={lineText(
                thread.path,
                thread.startLine ?? thread.line,
                thread.line
              )}
              thread={thread}
            />
          ))}
          {isDraftSite && draft ? (
            <CommentComposer
              busy={creating}
              hasPendingReview={commenting.pendingReview.pendingId !== null}
              mode="thread"
              onCancel={cancelDraft}
              onSubmit={submitDraft}
              suggestionSeed={lineText(
                draft.path,
                draft.startLine ?? draft.line,
                draft.line
              ).join("\n")}
              variant="card"
            />
          ) : null}
        </>
      );
    },
    [
      threadsByKey,
      draft,
      cancelDraft,
      submitDraft,
      creating,
      lineText,
      commenting,
    ]
  );

  const renderHeaderMetadata = useViewedHeader(viewedFiles, onSetViewed);

  return (
    <div className="flex min-h-0 min-w-0 flex-col" ref={rootRef}>
      <CodeView
        className={cn(
          "min-h-0 w-full overflow-y-auto overscroll-contain outline-none",
          CARD_CLASSES
        )}
        items={items}
        options={options}
        ref={handleRef}
        renderAnnotation={renderAnnotation}
        renderHeaderMetadata={renderHeaderMetadata}
        renderHeaderPrefix={renderFileTypePrefix}
        selectedLines={selectedLines}
      />
    </div>
  );
}
