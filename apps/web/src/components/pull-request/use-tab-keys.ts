import { isTypingTarget } from "@sphynx/ui/lib/typing-target";
import { useEffect } from "react";
import type { PullRequestSearchSetter } from "@/components/pull-request/pull-request-search";

export function useTabKeys(setSearch: PullRequestSearchSetter) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTypingTarget(event.target)
      ) {
        return;
      }
      if (event.key === "d") {
        event.preventDefault();
        setSearch({ tab: "diff" });
      }
      if (event.key === "c") {
        event.preventDefault();
        setSearch({ tab: "conversation" });
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [setSearch]);
}
