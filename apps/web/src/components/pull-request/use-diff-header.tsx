import type { PullRequestFile } from "@sphynx/schema/pull-requests";
import { useCallback, useMemo } from "react";
import { DiffCardHeader } from "@/components/pull-request/diff-card-header";

interface DiffStats {
  readonly additions: number;
  readonly deletions: number;
}

/** The main diff column's per-file header, shared with the definition pane. */
export function useDiffHeader(
  files: readonly PullRequestFile[],
  viewedFiles: ReadonlySet<string> | null,
  onSetViewed: (change: { path: string; viewed: boolean }) => void
) {
  const statsByPath = useMemo(() => {
    const map = new Map<string, DiffStats>();
    for (const file of files) {
      map.set(file.path, {
        additions: file.additions,
        deletions: file.deletions,
      });
    }
    return map;
  }, [files]);

  return useCallback(
    (item: { id: string }) => {
      const stats = statsByPath.get(item.id);
      return (
        <DiffCardHeader
          additions={stats?.additions}
          deletions={stats?.deletions}
          onViewedChange={(viewed) => onSetViewed({ path: item.id, viewed })}
          path={item.id}
          viewed={viewedFiles?.has(item.id) ?? false}
          viewedDisabled={viewedFiles === null}
        />
      );
    },
    [statsByPath, viewedFiles, onSetViewed]
  );
}
