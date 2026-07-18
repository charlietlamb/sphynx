import { useEffect, useRef } from "react";

export interface DashboardKeyHandlers {
  active: boolean;
  onBlock: () => void;
  onBranch: (index: number) => void;
  onDown: () => void;
  onMerge: () => void;
  onNextRepo: () => void;
  onOpen: () => void;
  onPrevRepo: () => void;
  onUp: () => void;
}

const DIGIT_PATTERN = /^[1-9]$/;

const BINDINGS: Record<
  string,
  Exclude<keyof DashboardKeyHandlers, "onBranch" | "active">
> = {
  j: "onDown",
  ArrowDown: "onDown",
  k: "onUp",
  ArrowUp: "onUp",
  Enter: "onOpen",
  p: "onOpen",
  m: "onMerge",
  b: "onBlock",
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
      if (
        event.metaKey ||
        event.ctrlKey ||
        isTypingTarget(event.target) ||
        !live.current.active
      ) {
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
