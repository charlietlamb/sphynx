import { isTypingTarget } from "@sphynx/ui/lib/typing-target";
import { useEffect } from "react";
import {
  compileKeymap,
  DEFAULT_KEYMAP,
  REVIEW_COMMANDS,
  type ReviewCommandId,
} from "@/components/pull-request/review-keymap";

export interface ReviewKeyHandlers {
  onAlignLine: (preset: "center" | "end" | "top") => void;
  onCancelDraft: () => void;
  onCancelHints: () => void;
  onClearSelection: () => void;
  onCloseTrail: () => void;
  onComment: () => void;
  onFocusColumn: (column: 0 | 1) => void;
  onHintKey: (key: string) => void;
  onJumpEdge: (edge: 1 | -1) => void;
  onJumpToCallSite: () => void;
  onMarkViewed: () => void;
  onMoveHunk: (direction: 1 | -1) => void;
  onMoveLine: (direction: 1 | -1) => void;
  onMovePage: (direction: 1 | -1) => void;
  onMoveSymbol: (direction: 1 | -1) => void;
  onMoveWord: (direction: 1 | -1) => void;
  onMoveWordEnd: () => void;
  onNextFile: () => void;
  onOpenSymbol: () => void;
  onPopTrail: () => void;
  onPrevFile: () => void;
  onStartHints: () => void;
  onToggleHelp: () => void;
  onToggleSidebar: () => void;
  onToggleVisual: () => void;
  onYank: () => void;
}

interface ReviewKeysInput {
  handlers: ReviewKeyHandlers;
  isDraftOpen: () => boolean;
  isHelpOpen: () => boolean;
  isHintsActive: () => boolean;
  isSelecting: () => boolean;
}

const KEYMAP = compileKeymap(DEFAULT_KEYMAP);
const HINT_KEY = /^[a-z]$/;
const COUNT_KEY = /^[0-9]$/;
const SEQUENCE_TIMEOUT = 800;

function lookupKey(event: KeyboardEvent) {
  return event.shiftKey && event.key.length > 1 ? `S-${event.key}` : event.key;
}

function escapeCommand(
  state: { draftOpen: boolean; helpOpen: boolean; selecting: boolean },
  handlers: ReviewKeyHandlers
) {
  if (state.helpOpen) {
    return handlers.onToggleHelp;
  }
  if (state.draftOpen) {
    return handlers.onCancelDraft;
  }
  if (state.selecting) {
    return handlers.onClearSelection;
  }
  return handlers.onCloseTrail;
}

export function useReviewKeys({
  handlers,
  isDraftOpen,
  isHelpOpen,
  isHintsActive,
  isSelecting,
}: ReviewKeysInput) {
  useEffect(() => {
    let pendingPrefix: string | null = null;
    let pendingTimer = 0;
    let countBuffer = "";
    const clearPending = () => {
      pendingPrefix = null;
      window.clearTimeout(pendingTimer);
    };
    const startPending = (prefix: string) => {
      clearPending();
      pendingPrefix = prefix;
      pendingTimer = window.setTimeout(clearPending, SEQUENCE_TIMEOUT);
    };
    const takeCount = () => {
      const count = countBuffer === "" ? 1 : Number(countBuffer);
      countBuffer = "";
      return count;
    };
    const resolveCommand = (key: string): ReviewCommandId | undefined => {
      if (pendingPrefix) {
        const sequence = KEYMAP.sequences[pendingPrefix]?.[key];
        clearPending();
        if (sequence) {
          return sequence;
        }
      }
      if (key in KEYMAP.sequences) {
        startPending(key);
        return;
      }
      return KEYMAP.singles[key];
    };
    const handleHintKey = (key: string) => {
      clearPending();
      if (HINT_KEY.test(key)) {
        handlers.onHintKey(key);
      } else {
        handlers.onCancelHints();
      }
    };
    const runCommand = (command: ReviewCommandId | undefined) =>
      command
        ? () => REVIEW_COMMANDS[command].run(handlers, takeCount())
        : undefined;
    const resolveAction = (event: KeyboardEvent): (() => void) | undefined => {
      const key = lookupKey(event);
      if (key === "Escape") {
        countBuffer = "";
        clearPending();
        return escapeCommand(
          {
            draftOpen: isDraftOpen(),
            helpOpen: isHelpOpen(),
            selecting: isSelecting(),
          },
          handlers
        );
      }
      if (COUNT_KEY.test(key) && !pendingPrefix && countBuffer + key !== "0") {
        countBuffer += key;
        return () => undefined;
      }
      return runCommand(resolveCommand(key));
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.altKey || isTypingTarget(event.target)) {
        return;
      }
      if (event.ctrlKey) {
        const action = runCommand(KEYMAP.ctrl[event.key]);
        if (action) {
          event.preventDefault();
          clearPending();
          action();
        }
        return;
      }
      if (isHintsActive()) {
        event.preventDefault();
        handleHintKey(event.key);
        return;
      }
      const action = resolveAction(event);
      if (action) {
        event.preventDefault();
        action();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      clearPending();
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [handlers, isDraftOpen, isHelpOpen, isHintsActive, isSelecting]);
}
