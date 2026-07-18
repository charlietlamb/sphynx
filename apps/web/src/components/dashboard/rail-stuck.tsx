import { cn } from "@sphynx/ui/lib/utils";
import { shortAge } from "@/lib/age";
import { pullKey, type StuckPull } from "@/lib/attention";

interface RailStuckProps {
  now: number;
  onFocus: (key: string) => void;
  stuck: readonly StuckPull[];
}

export function RailStuck({ now, onFocus, stuck }: RailStuckProps) {
  return (
    <div className="flex flex-col border-border border-t pt-2">
      <p className="px-2 pb-1 font-medium text-[11px] text-muted-foreground/60">
        stuck
      </p>
      {stuck.length === 0 ? (
        <p className="px-2 py-0.5 text-[11px] text-muted-foreground/40">
          nothing stuck
        </p>
      ) : (
        stuck.map(({ pull, reason }) => (
          <button
            className="flex h-6 w-full min-w-0 items-center gap-2 rounded-sm px-2 text-left transition-colors hover:bg-alpha-2"
            key={pullKey(pull)}
            onClick={() => onFocus(pullKey(pull))}
            type="button"
          >
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground/50 tabular-nums">
              #{pull.number}
            </span>
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-[11px]",
                "text-amber-500/90"
              )}
            >
              {reason}
            </span>
            <span className="shrink-0 text-[10px] text-muted-foreground/40 tabular-nums">
              {shortAge(pull.updatedAt, now)}
            </span>
          </button>
        ))
      )}
    </div>
  );
}
