import { useCallback } from "react";
import { CopyPathButton } from "@/components/pull-request/copy-path-button";
import { ViewedCheckbox } from "@/components/pull-request/viewed-checkbox";

export function useViewedHeader(
  viewedFiles: ReadonlySet<string> | null,
  onSetViewed: (change: { path: string; viewed: boolean }) => void
) {
  return useCallback(
    (item: { id: string }) => (
      <span className="flex items-center gap-1">
        <CopyPathButton path={item.id} />
        <ViewedCheckbox
          disabled={viewedFiles === null}
          onViewedChange={(viewed) => onSetViewed({ path: item.id, viewed })}
          viewed={viewedFiles?.has(item.id) ?? false}
        />
      </span>
    ),
    [viewedFiles, onSetViewed]
  );
}
