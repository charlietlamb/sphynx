import { isTypingTarget } from "@sphynx/ui/lib/typing-target";
import { useEffect, useEffectEvent } from "react";

export interface DashboardKeyHandlers {
  active: boolean;
  onBlock: () => void;
  onBranch: (index: number) => void;
  onDown: () => void;
  onMerge: () => void;
  onNextRepo: () => void;
  onOpen: () => void;
  onPrevRepo: () => void;
  onSearch: () => void;
  onUp: () => void;
  onWorkbench: () => void;
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
  "/": "onSearch",
  w: "onWorkbench",
};

export function useDashboardKeys(handlers: DashboardKeyHandlers) {
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (
      event.metaKey ||
      event.ctrlKey ||
      isTypingTarget(event.target) ||
      !handlers.active
    ) {
      return;
    }
    if (DIGIT_PATTERN.test(event.key)) {
      event.preventDefault();
      handlers.onBranch(Number(event.key) - 1);
      return;
    }
    const binding = BINDINGS[event.key];
    if (!binding) {
      return;
    }
    event.preventDefault();
    handlers[binding]();
  });
  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
