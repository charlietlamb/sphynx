import { useEffect, useRef } from "react";

export interface DashboardKeyHandlers {
  onBranch: (index: number) => void;
  onDown: () => void;
  onNextRepo: () => void;
  onOpen: () => void;
  onPrevRepo: () => void;
  onUp: () => void;
}

const DIGIT_PATTERN = /^[1-9]$/;

const BINDINGS: Record<
  string,
  Exclude<keyof DashboardKeyHandlers, "onBranch">
> = {
  j: "onDown",
  ArrowDown: "onDown",
  k: "onUp",
  ArrowUp: "onUp",
  Enter: "onOpen",
  "]": "onNextRepo",
  "[": "onPrevRepo",
};

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable)
  );
}

export function useDashboardKeys(handlers: DashboardKeyHandlers) {
  const live = useRef(handlers);
  useEffect(() => {
    live.current = handlers;
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || isTypingTarget(event.target)) {
        return;
      }
      if (DIGIT_PATTERN.test(event.key)) {
        event.preventDefault();
        live.current.onBranch(Number(event.key) - 1);
        return;
      }
      const binding = BINDINGS[event.key];
      if (!binding) {
        return;
      }
      event.preventDefault();
      live.current[binding]();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
