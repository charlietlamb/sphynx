import { useCallback } from "react";
import { ViewedCheckbox } from "@/components/pull-request/viewed-checkbox";

export function useViewedHeader(
  viewedFiles: ReadonlySet<string> | null,
  onSetViewed: (change: { path: string; viewed: boolean }) => void
) {
  return useCallback(
    (item: { id: string }) => (
      <ViewedCheckbox
        disabled={viewedFiles === null}
        onViewedChange={(viewed) => onSetViewed({ path: item.id, viewed })}
        viewed={viewedFiles?.has(item.id) ?? false}
      />
    ),
    [viewedFiles, onSetViewed]
  );
}
