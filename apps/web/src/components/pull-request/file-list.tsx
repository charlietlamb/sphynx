import { ChecksIcon, SidebarSimpleIcon } from "@phosphor-icons/react";
import type { PullRequestFile } from "@sphynx/schema/pull-requests";
import { Button } from "@sphynx/ui/components/ui/button";
import { ScrollArea } from "@sphynx/ui/components/ui/scroll-area";
import { useMemo, useState } from "react";
import { FileTree } from "@/components/pull-request/file-tree";
import { buildFileTree } from "@/lib/file-tree";
import type { FileRelations } from "@/lib/import-graph";
import { toggleSidebarCollapsed, useSettings } from "@/lib/settings";

interface FileListProps {
  files: readonly PullRequestFile[];
  onMarkAllViewed: () => void;
  onSelect: (path: string) => void;
  relations: FileRelations | null;
  selectedPath: string | undefined;
  viewedFiles: ReadonlySet<string> | null;
}

export function FileList({
  files,
  onMarkAllViewed,
  onSelect,
  relations,
  selectedPath,
  viewedFiles,
}: FileListProps) {
  const { settings } = useSettings();
  const [collapsedDirs, setCollapsedDirs] = useState<ReadonlySet<string>>(
    new Set()
  );
  const nodes = useMemo(() => buildFileTree(files), [files]);
  const allViewed = viewedFiles
    ? files.every((file) => viewedFiles.has(file.path))
    : false;
  const [revealedPath, setRevealedPath] = useState(selectedPath);
  if (selectedPath !== revealedPath) {
    setRevealedPath(selectedPath);
    const revealed = selectedPath
      ? [...collapsedDirs].filter((key) => !selectedPath.startsWith(`${key}/`))
      : null;
    if (revealed && revealed.length !== collapsedDirs.size) {
      setCollapsedDirs(new Set(revealed));
    }
  }
  const toggleDirectory = (key: string) => {
    const next = new Set(collapsedDirs);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setCollapsedDirs(next);
  };
  if (settings.sidebarCollapsed) {
    return (
      <div className="flex h-full w-10 flex-col items-center gap-2 rounded-md border border-border py-1.5">
        <Button
          aria-label="Expand file sidebar"
          onClick={toggleSidebarCollapsed}
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
    <div className="flex h-full w-64 flex-col rounded-md border border-border">
      <div className="flex items-center justify-between gap-1 border-border border-b py-1 pr-2 pl-1">
        <div className="flex min-w-0 items-center gap-1">
          <Button
            aria-label="Collapse file sidebar"
            className="text-muted-foreground"
            onClick={toggleSidebarCollapsed}
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
            className="h-6 px-1.5 text-muted-foreground text-xs"
            onClick={onMarkAllViewed}
            size="sm"
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
