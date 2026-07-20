import type { SelectedLineRange } from "@pierre/diffs";
import { useMemo } from "react";
import {
  DIFF_UNSAFE_CSS,
  keepSymbolsStamped,
  releaseSymbolStamping,
} from "@/components/pull-request/diff-symbols";
import type { DefinitionRef } from "@/components/pull-request/pull-request-search";
import type { SymbolIndex } from "@/components/pull-request/symbol-index";
import { useCodeTheme } from "@/components/pull-request/use-code-theme";

interface TokenClickProps {
  lineNumber: number;
  side?: "additions" | "deletions";
  tokenElement: HTMLElement;
  tokenText: string;
}

interface LineClickProps {
  annotationSide?: "additions" | "deletions";
  event: unknown;
  lineNumber: number;
}

interface TokenClickContext {
  item?: { id?: string };
}

interface CommentingCallbacks {
  onOpenDraft: (path: string, range: SelectedLineRange) => void;
  onSelectionChange: (path: string, range: SelectedLineRange | null) => void;
}

function commentingOptions(commenting: CommentingCallbacks | undefined) {
  if (!commenting) {
    return {};
  }
  return {
    enableGutterUtility: true,
    enableLineSelection: true,
    onGutterUtilityClick: (
      range: SelectedLineRange,
      context?: TokenClickContext
    ) => {
      const path = context?.item?.id;
      if (path) {
        commenting.onOpenDraft(path, range);
      }
    },
    onLineSelectionChange: (
      range: SelectedLineRange | null,
      context?: TokenClickContext
    ) => {
      const path = context?.item?.id;
      if (path) {
        commenting.onSelectionChange(path, range);
      }
    },
    onLineSelectionEnd: (
      range: SelectedLineRange | null,
      context?: TokenClickContext
    ) => {
      const path = context?.item?.id;
      if (!path) {
        return;
      }
      if (range && range.start !== range.end) {
        commenting.onOpenDraft(path, range);
      }
      commenting.onSelectionChange(path, null);
    },
    onLineNumberClick: () => undefined,
  };
}

interface DiffSymbolOptionsInput {
  commenting?: CommentingCallbacks;
  onNavigate: (definition: DefinitionRef) => void;
  onSelectLine?: (path: string, line: number, token?: HTMLElement) => void;
  symbolIndex: SymbolIndex;
}

export function useDiffSymbolOptions({
  commenting,
  onNavigate,
  onSelectLine,
  symbolIndex,
}: DiffSymbolOptionsInput) {
  const themeOptions = useCodeTheme();
  return useMemo(() => {
    let handledClickEvent: unknown = null;
    return {
      diffStyle: "unified" as const,
      expansionLineCount: 20,
      stickyHeaders: true,
      ...themeOptions,
      useTokenTransformer: true,
      unsafeCSS: DIFF_UNSAFE_CSS,
      ...commentingOptions(commenting),
      onTokenClick: (
        { lineNumber, side, tokenElement, tokenText }: TokenClickProps,
        event?: unknown,
        context?: TokenClickContext
      ) => {
        handledClickEvent = event ?? null;
        const path = context?.item?.id;
        if (!path || side === "deletions") {
          return;
        }
        const definition = tokenElement.hasAttribute("data-symbol")
          ? symbolIndex.get(tokenText)
          : undefined;
        if (definition) {
          onNavigate({
            path: definition.path,
            line: definition.lineNumber,
            anchorPath: path,
            anchorLine: lineNumber,
          });
          return;
        }
        onSelectLine?.(path, lineNumber, tokenElement);
      },
      onLineClick: (
        { annotationSide, event, lineNumber }: LineClickProps,
        context?: TokenClickContext
      ) => {
        if (event !== null && event === handledClickEvent) {
          return;
        }
        const path = context?.item?.id;
        if (path && annotationSide !== "deletions") {
          onSelectLine?.(path, lineNumber);
        }
      },
      onPostRender: (
        node: HTMLElement,
        _instance: unknown,
        phase: string,
        context?: TokenClickContext
      ) => {
        if (phase === "unmount") {
          releaseSymbolStamping(node);
          return;
        }
        if (context?.item?.id) {
          node.setAttribute("data-path", context.item.id);
        }
        keepSymbolsStamped(node, symbolIndex);
      },
    };
  }, [themeOptions, symbolIndex, onNavigate, onSelectLine, commenting]);
}
