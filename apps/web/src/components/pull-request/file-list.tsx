import { ChecksIcon, SidebarSimpleIcon } from "@phosphor-icons/react";
import type { PullRequestFile } from "@sphynx/schema/pull-requests";
import { Button } from "@sphynx/ui/components/ui/button";
import { ScrollArea } from "@sphynx/ui/components/ui/scroll-area";
import { useMemo, useState } from "react";
import { FileTree } from "@/components/pull-request/file-tree";
import { useSettings } from "@/components/settings/settings-provider";
import { buildFileTree } from "@/lib/file-tree";
import type { FileRelations } from "@/lib/import-graph";

interface FileListProps {
  files: readonly PullRequestFile[];
  onMarkAllViewed: () => void;
  onSelect: (path: string) => void;
  relations: FileRelations | null;
  selectedPath: string | undefined;
  viewedFiles: ReadonlySet<string> | null;
}

interface TreeState {
  collapsed: ReadonlySet<string>;
  revealedFor: string | undefined;
}

export function FileList({
  files,
  onMarkAllViewed,
  onSelect,
  relations,
  selectedPath,
  viewedFiles,
}: FileListProps) {
  const { settings, update } = useSettings();
  const toggleSidebar = () =>
    update((previous) => ({ sidebarCollapsed: !previous.sidebarCollapsed }));
  const [treeState, setTreeState] = useState<TreeState>({
    collapsed: new Set(),
    revealedFor: undefined,
  });
  const nodes = useMemo(() => buildFileTree(files), [files]);
  const allViewed = viewedFiles
    ? files.every((file) => viewedFiles.has(file.path))
    : false;
  if (selectedPath !== treeState.revealedFor) {
    setTreeState((previous) => ({
      collapsed: selectedPath
        ? new Set(
            [...previous.collapsed].filter(
              (key) => !selectedPath.startsWith(`${key}/`)
            )
          )
        : previous.collapsed,
      revealedFor: selectedPath,
    }));
  }
  const collapsedDirs = treeState.collapsed;
  const toggleDirectory = (key: string) => {
    setTreeState((previous) => {
      const collapsed = new Set(previous.collapsed);
      if (collapsed.has(key)) {
        collapsed.delete(key);
      } else {
        collapsed.add(key);
      }
      return { ...previous, collapsed };
    });
  };
  if (settings.sidebarCollapsed) {
    return (
      <div className="flex h-full w-10 flex-col items-center gap-2 border-border border-r py-1.5">
        <Button
          aria-label="Expand file sidebar"
          onClick={toggleSidebar}
          size="icon-sm"
          variant="ghost"
        >
          <SidebarSimpleIcon />
        </Button>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {files.length}
        </span>
      </div>
    );
  }
  return (
    <div className="flex h-full w-64 flex-col border-border border-r">
      <div className="flex items-center justify-between gap-1 border-border border-b py-1 pr-2 pl-1">
        <div className="flex min-w-0 items-center gap-1">
          <Button
            aria-label="Collapse file sidebar"
            className="text-muted-foreground"
            onClick={toggleSidebar}
            size="icon-sm"
            variant="ghost"
          >
            <SidebarSimpleIcon />
          </Button>
          <span className="text-muted-foreground text-xs tabular-nums">
            {files.length} files
          </span>
        </div>
        {viewedFiles && !allViewed ? (
          <Button
            className="text-muted-foreground"
            onClick={onMarkAllViewed}
            size="xs"
            variant="ghost"
          >
            <ChecksIcon className="size-3.5" />
            Mark all viewed
          </Button>
        ) : null}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <nav aria-label="Changed files" className="flex flex-col py-1">
          <FileTree
            collapsedDirs={collapsedDirs}
            nodes={nodes}
            onSelect={onSelect}
            onToggleDirectory={toggleDirectory}
            relations={relations}
            selectedPath={selectedPath}
            viewedFiles={viewedFiles}
          />
        </nav>
      </ScrollArea>
    </div>
  );
}
