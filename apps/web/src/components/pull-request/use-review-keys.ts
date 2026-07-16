import { useEffect } from "react";

export interface ReviewKeyHandlers {
  onCancelDraft: () => void;
  onCancelHints: () => void;
  onCloseTrail: () => void;
  onComment: () => void;
  onFocusColumn: (column: 0 | 1) => void;
  onHintKey: (key: string) => void;
  onJumpToCallSite: () => void;
  onMarkViewed: () => void;
  onMoveLine: (direction: 1 | -1) => void;
  onMoveSymbol: (direction: 1 | -1) => void;
  onMoveWord: (direction: 1 | -1) => void;
  onMoveWordEnd: () => void;
  onNextFile: () => void;
  onOpenSymbol: () => void;
  onPopTrail: () => void;
  onPrevFile: () => void;
  onStartHints: () => void;
  onToggleHelp: () => void;
}

interface ReviewKeysInput {
  handlers: ReviewKeyHandlers;
  isDraftOpen: () => boolean;
  isHelpOpen: () => boolean;
  isHintsActive: () => boolean;
}

const HINT_KEY = /^[a-z]$/;

function isEditable(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    target.closest("input, textarea, select, [contenteditable=true]") !== null
  );
}

export function useReviewKeys({
  handlers,
  isDraftOpen,
  isHelpOpen,
  isHintsActive,
}: ReviewKeysInput) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isEditable(event.target)
      ) {
        return;
      }
      if (isHintsActive()) {
        event.preventDefault();
        handleHintKey(event.key, handlers);
        return;
      }
      const action = keyAction(
        event.key,
        { draftOpen: isDraftOpen(), helpOpen: isHelpOpen() },
        handlers
      );
      if (action) {
        event.preventDefault();
        action();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handlers, isDraftOpen, isHelpOpen, isHintsActive]);
}

function handleHintKey(key: string, handlers: ReviewKeyHandlers) {
  if (HINT_KEY.test(key)) {
    handlers.onHintKey(key);
    return;
  }
  handlers.onCancelHints();
}

function escapeAction(
  state: { draftOpen: boolean; helpOpen: boolean },
  handlers: ReviewKeyHandlers
) {
  if (state.helpOpen) {
    return handlers.onToggleHelp;
  }
  if (state.draftOpen) {
    return handlers.onCancelDraft;
  }
  return handlers.onCloseTrail;
}

function keyAction(
  key: string,
  state: { draftOpen: boolean; helpOpen: boolean },
  handlers: ReviewKeyHandlers
) {
  const actions: Record<string, () => void> = {
    j: () => handlers.onMoveLine(1),
    k: () => handlers.onMoveLine(-1),
    h: () => handlers.onMoveSymbol(-1),
    l: () => handlers.onMoveSymbol(1),
    w: () => handlers.onMoveWord(1),
    b: () => handlers.onMoveWord(-1),
    e: handlers.onMoveWordEnd,
    J: handlers.onNextFile,
    K: handlers.onPrevFile,
    H: () => handlers.onFocusColumn(0),
    L: () => handlers.onFocusColumn(1),
    u: handlers.onPopTrail,
    z: handlers.onJumpToCallSite,
    v: handlers.onMarkViewed,
    c: handlers.onComment,
    f: handlers.onStartHints,
    Enter: handlers.onOpenSymbol,
    "?": handlers.onToggleHelp,
    Escape: escapeAction(state, handlers),
  };
  return actions[key];
}
