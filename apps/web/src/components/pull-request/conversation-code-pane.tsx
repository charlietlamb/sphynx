import { FileCodeIcon, XIcon } from "@phosphor-icons/react";
import { getSingularPatch } from "@pierre/diffs";
import { CodeView } from "@pierre/diffs/react";
import type { ReviewThread } from "@sphynx/schema/pull-request-comments";
import type { PullRequestFile } from "@sphynx/schema/pull-requests";
import { Button } from "@sphynx/ui/components/ui/button";
import { cn } from "@sphynx/ui/lib/utils";
import { useEffect, useMemo, useRef } from "react";
import {
  type Handle,
  scrollToLine,
} from "@/components/pull-request/code-view-scroll";
import { CARD_CLASSES } from "@/components/pull-request/diff-card-classes";
import { DiffWorkerPool } from "@/components/pull-request/diff-worker-pool";
import { toGitPatch } from "@/components/pull-request/pull-request-queries";
import { useCodeTheme } from "@/components/pull-request/use-code-theme";

interface ConversationCodePaneProps {
  file: PullRequestFile | null;
  onClose: () => void;
  onOpenInDiff: (thread: ReviewThread) => void;
  patch: string | null;
  thread: ReviewThread;
}

export function ConversationCodePane({
  file,
  onClose,
  onOpenInDiff,
  patch,
  thread,
}: ConversationCodePaneProps) {
  const themeOptions = useCodeTheme();
  const options = useMemo(
    () => ({ diffStyle: "unified" as const, ...themeOptions }),
    [themeOptions]
  );
  const items = useMemo(
    () =>
      file
        ? [
            {
              id: file.path,
              type: "diff" as const,
              fileDiff: getSingularPatch(toGitPatch(file, patch)),
              version: 0,
            },
          ]
        : [],
    [file, patch]
  );
  const selectedLines = useMemo(
    () => ({
      id: thread.path,
      range: {
        start: thread.startLine ?? thread.line,
        end: thread.line,
        side: thread.side,
      },
    }),
    [thread]
  );
  const handleRef = useRef<Handle>(null);
  const anchorLine = thread.startLine ?? thread.line;
  const anchorPath = thread.path;
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      scrollToLine(handleRef.current, anchorPath, anchorLine, "center")
    );
    return () => cancelAnimationFrame(frame);
  }, [anchorPath, anchorLine]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-1.5 border-border border-b pr-1.5 pl-4">
        <span className="shrink-0 text-muted-foreground/60">
          <FileCodeIcon className="size-3" weight="fill" />
        </span>
        <span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">
          {thread.path}:{thread.line}
        </span>
        <Button
          className="ml-auto h-6 shrink-0 px-2 text-muted-foreground text-xs"
          onClick={() => onOpenInDiff(thread)}
          size="sm"
          variant="ghost"
        >
          Open in diff
        </Button>
        <Button
          aria-label="Back to overview"
          className="size-6 shrink-0 text-muted-foreground"
          onClick={onClose}
          size="icon-sm"
          variant="ghost"
        >
          <XIcon className="size-3.5" />
        </Button>
      </div>
      {file ? (
        <DiffWorkerPool>
          <CodeView
            className={cn(
              "min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 outline-none",
              CARD_CLASSES
            )}
            items={items}
            options={options}
            ref={handleRef}
            selectedLines={selectedLines}
          />
        </DiffWorkerPool>
      ) : (
        <p className="px-4 py-3 text-[11px] text-muted-foreground/60">
          This thread references lines that are not in the current diff.
        </p>
      )}
    </div>
  );
}
