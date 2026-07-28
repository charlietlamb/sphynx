import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@sphynx/ui/components/ui/resizable";
import type { ReactNode } from "react";

interface DiffWorkspaceLayoutProps {
  /** The slim rail when the file sidebar is collapsed skips the resizable split. */
  collapsed: boolean;
  diff: ReactNode;
  fileTree: ReactNode;
}

/**
 * The file-tree / diff split. Expanded, the two are a resizable pair whose split
 * persists; collapsed, the file rail is a fixed slim column and the diff takes
 * the rest.
 */
export function DiffWorkspaceLayout({
  collapsed,
  diff,
  fileTree,
}: DiffWorkspaceLayoutProps) {
  if (collapsed) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 gap-2.5">
        <div className="h-full w-10 shrink-0">{fileTree}</div>
        <div className="min-h-0 min-w-0 flex-1">{diff}</div>
      </div>
    );
  }
  return (
    <ResizablePanelGroup
      autoSaveId="pr-diff-panes"
      className="min-h-0 min-w-0 flex-1"
      direction="horizontal"
    >
      <ResizablePanel defaultSize={22} maxSize={40} minSize={14}>
        {fileTree}
      </ResizablePanel>
      <ResizableHandle className="mx-1" />
      <ResizablePanel defaultSize={78} minSize={40}>
        {diff}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
