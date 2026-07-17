import {
  CaretRightIcon,
  FolderIcon,
  FolderOpenIcon,
} from "@phosphor-icons/react";
import type { PullRequestFile } from "@sphynx/schema/pull-requests";
import { cn } from "@sphynx/ui/lib/utils";
import { DiffStat } from "@/components/pull-request/diff-stat";
import { FileTypeIcon } from "@/components/pull-request/file-type-icon";
import type { FileTreeNode } from "@/lib/file-tree";
import type { FileRelations } from "@/lib/import-graph";

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

const indent = (depth: number) => ({ paddingLeft: 10 + depth * 12 });

function baseName(path: string) {
  const index = path.lastIndexOf("/");
  return index === -1 ? path : path.slice(index + 1);
}

function displayName(file: PullRequestFile) {
  const name = baseName(file.path);
  if (!file.previousPath) {
    return name;
  }
  const previous = baseName(file.previousPath);
  return previous === name ? name : `${previous} → ${name}`;
}

function rowTitle(file: PullRequestFile) {
  if (file.previousPath) {
    return `${file.previousPath} → ${file.path}`;
  }
  return file.path;
}

function relationGlyph(dependency: boolean, dependent: boolean) {
  if (dependency && dependent) {
    return "⇅";
  }
  return dependency ? "↑" : "↓";
}

interface RelationMarkerProps {
  path: string;
  relations: FileRelations | null;
  selectedName: string;
}

function RelationMarker({
  path,
  relations,
  selectedName,
}: RelationMarkerProps) {
  const dependency = relations?.imports.has(path) ?? false;
  const dependent = relations?.importedBy.has(path) ?? false;
  if (!(dependency || dependent)) {
    return null;
  }
  const title = [
    dependency ? `Imported by ${selectedName}` : null,
    dependent ? `Imports ${selectedName}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <span className="shrink-0 font-mono text-[10px] text-primary" title={title}>
      {relationGlyph(dependency, dependent)}
    </span>
  );
}

export interface FileTreeProps {
  collapsedDirs: ReadonlySet<string>;
  nodes: FileTreeNode[];
  onSelect: (path: string) => void;
  onToggleDirectory: (key: string) => void;
  relations: FileRelations | null;
  selectedPath: string | undefined;
  viewedFiles: ReadonlySet<string> | null;
}

export function FileTree(props: FileTreeProps) {
  const {
    collapsedDirs,
    nodes,
    onSelect,
    onToggleDirectory,
    relations,
    selectedPath,
    viewedFiles,
  } = props;
  const selectedName = selectedPath ? baseName(selectedPath) : "";
  return (
    <>
      {nodes.map((node) => {
        if (node.type === "directory") {
          const open = !collapsedDirs.has(node.key);
          return (
            <div key={node.key}>
              <button
                className="flex w-full items-center gap-1 py-1 pr-3 text-left text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => onToggleDirectory(node.key)}
                style={indent(node.depth)}
                title={node.key}
                type="button"
              >
                <CaretRightIcon
                  className={cn(
                    "size-3 shrink-0 transition-transform",
                    open && "rotate-90"
                  )}
                />
                {open ? (
                  <FolderOpenIcon className="size-3.5 shrink-0" />
                ) : (
                  <FolderIcon className="size-3.5 shrink-0" />
                )}
                <span className="truncate font-mono text-xs">{node.label}</span>
              </button>
              {open ? <FileTree {...props} nodes={node.children} /> : null}
            </div>
          );
        }
        const { file } = node;
        const status = STATUS_STYLES[file.status];
        const selected = file.path === selectedPath;
        return (
          <button
            aria-current={selected ? "page" : undefined}
            className={cn(
              "flex w-full items-center gap-2 py-1 pr-3 text-left transition-colors",
              selected ? "bg-muted" : "hover:bg-muted/50",
              viewedFiles?.has(file.path) && "opacity-50"
            )}
            key={file.path}
            onClick={() => onSelect(file.path)}
            style={indent(node.depth + 1)}
            title={rowTitle(file)}
            type="button"
          >
            <span
              className={cn("w-3 shrink-0 font-mono text-xs", status.className)}
            >
              {status.letter}
            </span>
            <FileTypeIcon className="size-3.5 shrink-0" path={file.path} />
            <span className="min-w-0 flex-1 truncate font-mono text-xs">
              {displayName(file)}
            </span>
            {selected ? null : (
              <RelationMarker
                path={file.path}
                relations={relations}
                selectedName={selectedName}
              />
            )}
            <span className="shrink-0">
              <DiffStat additions={file.additions} deletions={file.deletions} />
            </span>
          </button>
        );
      })}
    </>
  );
}
