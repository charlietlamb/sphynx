import type { QueuePull } from "@sphynx/schema/review-queue";
import { cn } from "@sphynx/ui/lib/utils";
import { sizeClass } from "@/lib/attention";

const LEVELS: Record<ReturnType<typeof sizeClass>, number> = {
  xs: 1,
  s: 2,
  m: 3,
  l: 4,
  xl: 5,
};

const TICKS = [1, 2, 3, 4, 5];
const TICK_HEIGHTS = [4, 5.5, 7, 8.5, 10];

function fillClass(level: number) {
  if (level >= 5) {
    return "bg-amber-500/90";
  }
  if (level >= 4) {
    return "bg-amber-500/60";
  }
  return "bg-muted-foreground/60";
}

export function SizeTicks({ pull }: { pull: QueuePull }) {
  const size = sizeClass(pull);
  const level = LEVELS[size];
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-end gap-px"
      title={`${size} · +${pull.additions} −${pull.deletions} · ${pull.changedFiles} files`}
    >
      {TICKS.map((tick) => (
        <span
          className={cn(
            "w-[3px] rounded-[1px]",
            tick <= level ? fillClass(level) : "bg-muted-foreground/15"
          )}
          key={tick}
          style={{ height: TICK_HEIGHTS[tick - 1] }}
        />
      ))}
    </span>
  );
}
