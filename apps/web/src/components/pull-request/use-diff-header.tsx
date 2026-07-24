import type { PullRequestFile } from "@sphynx/schema/pull-requests";
import { useCallback, useMemo } from "react";
import { CopyPathButton } from "@/components/pull-request/copy-path-button";
import { DiffStat } from "@/components/pull-request/diff-stat";
import { FileTypeIcon } from "@/components/pull-request/file-type-icon";
import { ViewedCheckbox } from "@/components/pull-request/viewed-checkbox";

interface DiffStats {
  readonly additions: number;
  readonly deletions: number;
}

/**
 * The full diff-card header, taking over pierre's default header so the copy
 * button can sit immediately to the right of the filename (pierre's own header
 * only offers a left prefix slot and a far-right metadata slot). Layout:
 * `[icon] filename [copy] ......... +N −M [viewed]`.
 */
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
      /**
       * The custom-header slot does not inherit pierre's default-header shell
       * (height, side padding, centering, sticky background all scope to
       * `[data-diffs-header="default"]`), so reproduce them here: h-11 matches
       * the library's diffHeaderHeight (44px), px-4 its 16px inline padding.
       */
      return (
        <span className="flex h-11 min-w-0 flex-1 items-center gap-2 bg-background px-4 text-[13px]">
          <FileTypeIcon
            className="size-3.5 shrink-0 text-foreground"
            path={item.id}
          />
          <span className="min-w-0 truncate" dir="rtl">
            {item.id}
          </span>
          <CopyPathButton path={item.id} />
          <span className="ml-auto flex shrink-0 items-center gap-3">
            {stats ? (
              <DiffStat
                additions={stats.additions}
                deletions={stats.deletions}
              />
            ) : null}
            <ViewedCheckbox
              disabled={viewedFiles === null}
              onViewedChange={(viewed) =>
                onSetViewed({ path: item.id, viewed })
              }
              viewed={viewedFiles?.has(item.id) ?? false}
            />
          </span>
        </span>
      );
    },
    [statsByPath, viewedFiles, onSetViewed]
  );
}
