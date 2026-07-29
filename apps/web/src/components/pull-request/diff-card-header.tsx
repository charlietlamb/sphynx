import { XIcon } from "@phosphor-icons/react";
import { Button } from "@sphynx/ui/components/ui/button";
import { CopyPathButton } from "@/components/pull-request/copy-path-button";
import { DiffStat } from "@/components/pull-request/diff-stat";
import { FileTypeIcon } from "@/components/pull-request/file-type-icon";
import { ViewedCheckbox } from "@/components/pull-request/viewed-checkbox";

interface DiffCardHeaderProps {
  additions?: number;
  deletions?: number;
  onClose?: () => void;
  onViewedChange: (viewed: boolean) => void;
  path: string;
  viewed: boolean;
  viewedDisabled: boolean;
}

/**
 * The shared diff-card header, replacing pierre's default header so the copy
 * button sits by the filename and every diff/definition card reads as the same
 * card chrome. Layout: `[icon] filename [copy] ......... +N −M [viewed] [×?]`.
 * `h-11` matches the library's diffHeaderHeight; `px-4` its inline padding.
 */
export function DiffCardHeader({
  additions,
  deletions,
  onClose,
  onViewedChange,
  path,
  viewed,
  viewedDisabled,
}: DiffCardHeaderProps) {
  return (
    <span className="flex h-11 min-w-0 flex-1 items-center gap-2.5 border-border border-b bg-card px-4 text-sm">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-muted/60 [&_svg]:size-3">
        <FileTypeIcon className="text-foreground" path={path} />
      </span>
      <span
        className="min-w-0 truncate font-heading font-medium text-foreground tracking-tight"
        dir="rtl"
      >
        {path}
      </span>
      <CopyPathButton path={path} />
      <span className="ml-auto flex shrink-0 items-center gap-3">
        {additions === undefined || deletions === undefined ? null : (
          <DiffStat additions={additions} deletions={deletions} />
        )}
        <ViewedCheckbox
          disabled={viewedDisabled}
          onViewedChange={onViewedChange}
          viewed={viewed}
        />
        {onClose ? (
          <Button
            aria-label="Close pane"
            className="-mr-1 text-muted-foreground"
            onClick={onClose}
            size="icon-xs"
            title="Close pane"
            variant="ghost"
          >
            <XIcon />
          </Button>
        ) : null}
      </span>
    </span>
  );
}
