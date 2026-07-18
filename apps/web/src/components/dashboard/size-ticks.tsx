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

export function SizeTicks({ pull }: { pull: QueuePull }) {
  const size = sizeClass(pull);
  const level = LEVELS[size];
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center gap-px"
      title={`${size} · +${pull.additions} −${pull.deletions} · ${pull.changedFiles} files`}
    >
      {TICKS.map((tick) => (
        <span
          className={cn(
            "h-[9px] w-[3px] rounded-[1px]",
            tick <= level ? "bg-muted-foreground/50" : "bg-muted-foreground/15"
          )}
          key={tick}
        />
      ))}
    </span>
  );
}
