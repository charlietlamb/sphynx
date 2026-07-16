import { type RefObject, useEffect } from "react";

export function useActiveDiffContainer(
  rootRef: RefObject<HTMLDivElement | null>,
  activePath: string | null
) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    const sync = () => {
      for (const container of root.querySelectorAll("diffs-container")) {
        container.toggleAttribute(
          "data-active",
          container.getAttribute("data-path") === activePath
        );
      }
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-path"],
    });
    return () => observer.disconnect();
  }, [rootRef, activePath]);
}
