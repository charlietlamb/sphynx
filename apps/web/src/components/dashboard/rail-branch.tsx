import { cn } from "@sphynx/ui/lib/utils";
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
        "group flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors",
        active ? "bg-muted/50" : "hover:bg-muted/30"
      )}
      onClick={onSelect}
      type="button"
    >
      <span
        aria-hidden
        className={cn(
          "size-[7px] shrink-0 rounded-full",
          item.isStage
            ? "bg-foreground"
            : "border border-muted-foreground bg-transparent"
        )}
      />
      <span
        className={cn(
          "min-w-0 flex-1 truncate font-mono text-xs",
          item.isStage ? "text-foreground" : "text-muted-foreground"
        )}
        title={item.branch}
      >
        {item.branch}
      </span>
      <span className="shrink-0 font-mono text-[11px] tabular-nums">
        {item.mergeable > 0 ? (
          <>
            <span
              className="text-addition"
              title={`${item.mergeable} approved and green — ready to merge`}
            >
              {item.mergeable}
            </span>
            <span className="text-muted-foreground/40"> · </span>
          </>
        ) : null}
        {item.contested > 0 ? (
          <>
            <span
              className="text-deletion"
              title={`${item.contested} contested — failing checks or changes requested`}
            >
              {item.contested}
            </span>
            <span className="text-muted-foreground/40"> · </span>
          </>
        ) : null}
        <span className="text-muted-foreground/60">{item.total}</span>
      </span>
      {hint === null ? null : (
        <kbd className="shrink-0 rounded-sm border border-border bg-muted/40 px-1 py-px font-mono text-[9px] text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100">
          {hint}
        </kbd>
      )}
    </button>
  );
}
