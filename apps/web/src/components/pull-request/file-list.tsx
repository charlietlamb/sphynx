import { ChecksIcon } from "@phosphor-icons/react";
import type { PullRequestFile } from "@sphynx/schema/pull-requests";
import { Button } from "@sphynx/ui/components/ui/button";
import { ScrollArea } from "@sphynx/ui/components/ui/scroll-area";
import { cn } from "@sphynx/ui/lib/utils";
import { DiffStat } from "@/components/pull-request/diff-stat";

const STATUS_STYLES: Record<
  PullRequestFile["status"],
  { letter: string; className: string }
> = {
  added: { letter: "A", className: "text-addition" },
  modified: { letter: "M", className: "text-amber-600 dark:text-amber-400" },
  deleted: { letter: "D", className: "text-deletion" },
  renamed: { letter: "R", className: "text-sky-600 dark:text-sky-400" },
  copied: { letter: "C", className: "text-sky-600 dark:text-sky-400" },
  unknown: { letter: "?", className: "text-muted-foreground" },
};

function displayPath(file: PullRequestFile) {
  if (file.previousPath) {
    return `${file.previousPath} → ${file.path}`;
  }
  return file.path;
}

function splitPath(path: string) {
  const index = path.lastIndexOf("/");
  if (index === -1) {
    return { directory: "", name: path };
  }
  return { directory: path.slice(0, index + 1), name: path.slice(index + 1) };
}

interface FileListProps {
  files: readonly PullRequestFile[];
  onMarkAllViewed: () => void;
  onSelect: (path: string) => void;
  selectedPath: string | undefined;
  viewedFiles: ReadonlySet<string> | null;
}

export function FileList({
  files,
  onMarkAllViewed,
  onSelect,
  selectedPath,
  viewedFiles,
}: FileListProps) {
  const allViewed = viewedFiles
    ? files.every((file) => viewedFiles.has(file.path))
    : false;
  return (
    <div className="flex h-full flex-col rounded-md border border-border">
      <div className="flex items-center justify-between gap-2 border-border border-b px-3 py-1.5">
        <span className="text-muted-foreground text-xs tabular-nums">
          {files.length} files
        </span>
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
          {files.map((file) => {
            const status = STATUS_STYLES[file.status];
            const selected = file.path === selectedPath;
            const { directory, name } = splitPath(displayPath(file));
            return (
              <button
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors",
                  selected ? "bg-muted" : "hover:bg-muted/50",
                  viewedFiles?.has(file.path) && "opacity-50"
                )}
                key={file.path}
                onClick={() => onSelect(file.path)}
                type="button"
              >
                <span
                  className={cn(
                    "w-3 shrink-0 font-mono text-xs",
                    status.className
                  )}
                >
                  {status.letter}
                </span>
                <span
                  className="flex min-w-0 flex-1 items-baseline font-mono text-xs"
                  title={displayPath(file)}
                >
                  {directory === "" ? null : (
                    <span className="shrink-[9999] truncate text-muted-foreground">
                      {directory}
                    </span>
                  )}
                  <span className="min-w-0 truncate">{name}</span>
                </span>
                <span className="shrink-0">
                  <DiffStat
                    additions={file.additions}
                    deletions={file.deletions}
                  />
                </span>
              </button>
            );
          })}
        </nav>
      </ScrollArea>
    </div>
  );
}
