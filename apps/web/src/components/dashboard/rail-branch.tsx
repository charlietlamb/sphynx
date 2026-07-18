import { cn } from "@sphynx/ui/lib/utils";
import { QueueCounts } from "@/components/dashboard/queue-counts";
import { SignalTip } from "@/components/dashboard/signal-tip";
import type { RailBranchItem } from "@/lib/attention";

interface RailBranchProps {
  active: boolean;
  hint: number | null;
  item: RailBranchItem;
  onSelect: () => void;
}

export function RailBranch({ active, hint, item, onSelect }: RailBranchProps) {
  return (
    <button
      className={cn(
        "group relative flex h-7 w-full items-center gap-2 rounded-md pr-2 pl-7 text-left transition-colors",
        active ? "bg-primary/5" : "hover:bg-alpha-2"
      )}
      onClick={onSelect}
      type="button"
    >
      {item.isStage ? (
        <span
          aria-hidden
          className="absolute left-[10px] size-[7px] rounded-full bg-foreground"
        />
      ) : (
        <>
          <span
            aria-hidden
            className="absolute top-[-2px] left-[13px] h-[calc(50%+2px)] w-[11px] rounded-bl-md border-border border-b border-l"
          />
          <span
            aria-hidden
            className="absolute left-[26px] size-[5px] rounded-full border border-muted-foreground bg-background"
          />
        </>
      )}
      <SignalTip
        className={cn(
          "block min-w-0 flex-1 truncate text-left font-mono text-xs [direction:rtl]",
          !item.isStage && "pl-4",
          active && "text-primary",
          !active &&
            (item.isStage ? "text-foreground" : "text-muted-foreground")
        )}
        label={item.branch}
      >
        {item.branch}
      </SignalTip>
      <QueueCounts
        contested={item.contested}
        mergeable={item.mergeable}
        total={item.total}
      />
      {hint === null ? null : (
        <kbd className="shrink-0 rounded-sm border border-border bg-muted/40 px-1 py-px font-mono text-[9px] text-muted-foreground/60 uppercase opacity-0 transition-opacity group-hover:opacity-100">
          {hint}
        </kbd>
      )}
    </button>
  );
}
