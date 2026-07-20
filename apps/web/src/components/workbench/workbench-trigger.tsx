import { PulseIcon } from "@phosphor-icons/react";
import { Kbd } from "@sphynx/ui/components/ui/kbd";

interface WorkbenchTriggerProps {
  onOpen: () => void;
  unseen: number;
}

export function WorkbenchTrigger({ onOpen, unseen }: WorkbenchTriggerProps) {
  return (
    <button
      aria-label="Open the repo workbench"
      className="group flex h-9 w-full shrink-0 items-center gap-2 border-border border-t px-3 text-left transition-colors hover:bg-alpha-4"
      onClick={onOpen}
      type="button"
    >
      <PulseIcon
        aria-hidden
        className="size-3.5 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-foreground"
        weight="fill"
      />
      <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground transition-colors group-hover:text-foreground">
        Workbench
      </span>
      {unseen > 0 ? (
        <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-px font-medium text-[10px] text-primary tabular-nums">
          {unseen}
        </span>
      ) : null}
      <Kbd className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        W
      </Kbd>
    </button>
  );
}
