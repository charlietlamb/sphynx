import type { PromotedPull } from "@sphynx/schema/review-queue";
import { shortAge } from "@/lib/age";

interface ShippedRowProps {
  now: number;
  onOpen: () => void;
  pull: PromotedPull;
}

export function ShippedRow({ now, onOpen, pull }: ShippedRowProps) {
  return (
    <button
      className="flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-left transition-colors hover:bg-muted/30"
      onClick={onOpen}
      type="button"
    >
      <span
        aria-hidden
        className="size-[7px] shrink-0 rounded-full bg-addition/60"
      />
      <span className="shrink-0 font-mono text-[11px] text-muted-foreground/50 tabular-nums">
        #{pull.number}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
        {pull.title}
      </span>
      {pull.author ? (
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground/50">
          {pull.author.login}
        </span>
      ) : null}
      <span className="w-7 shrink-0 text-right font-mono text-[11px] text-muted-foreground/50 tabular-nums">
        {pull.mergedAt ? shortAge(pull.mergedAt, now) : ""}
      </span>
    </button>
  );
}
