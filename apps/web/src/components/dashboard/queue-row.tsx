import type { QueuePull } from "@sphynx/schema/review-queue";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@sphynx/ui/components/ui/avatar";
import { cn } from "@sphynx/ui/lib/utils";
import { useEffect, useRef } from "react";
import { CiSlot } from "@/components/dashboard/ci-slot";
import { ReviewerStack } from "@/components/dashboard/reviewer-stack";
import { ScoreSlot } from "@/components/dashboard/score-slot";
import { SignalTip } from "@/components/dashboard/signal-tip";
import { SizeTicks } from "@/components/dashboard/size-ticks";
import { fullDate, shortAge } from "@/lib/age";

const INDENT_STEP = 16;
const BASE_INDENT = 26;
const STICKY_HEADER_OFFSET = 78;
const SCROLL_MARGIN = 8;

interface QueueRowProps {
  depth?: number;
  focused: boolean;
  now: number;
  onFocus: () => void;
  onOpen: () => void;
  pull: QueuePull;
}

export function QueueRow({
  depth = 0,
  focused,
  now,
  onFocus,
  onOpen,
  pull,
}: QueueRowProps) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!focused) {
      return;
    }
    const row = ref.current;
    if (!row) {
      return;
    }
    const scroller = row.closest("section");
    if (!scroller) {
      return;
    }
    const rowBox = row.getBoundingClientRect();
    const viewBox = scroller.getBoundingClientRect();
    const overTop = rowBox.top - (viewBox.top + STICKY_HEADER_OFFSET);
    const overBottom = rowBox.bottom - viewBox.bottom;
    if (overTop < 0) {
      scroller.scrollBy({ top: overTop - SCROLL_MARGIN });
      return;
    }
    if (overBottom > 0) {
      scroller.scrollBy({ top: overBottom + SCROLL_MARGIN });
    }
  }, [focused]);

  return (
    <button
      className={cn(
        "group relative -mx-4 flex h-10 w-[calc(100%+2rem)] items-center gap-2.5 border-border/40 border-b pr-[26px] text-left",
        focused
          ? "z-[1] -mt-px border-border border-t bg-primary/10"
          : "transition-colors hover:bg-alpha-4"
      )}
      onClick={onFocus}
      onDoubleClick={onOpen}
      ref={ref}
      style={{ paddingLeft: BASE_INDENT + depth * INDENT_STEP }}
      type="button"
    >
      <Avatar className="size-5 shrink-0 rounded-full">
        <AvatarImage
          alt={pull.author?.login ?? "unknown"}
          className="rounded-full"
          src={pull.author?.avatarUrl}
        />
        <AvatarFallback className="rounded-full text-[9px]">
          {pull.author?.login[0] ?? "?"}
        </AvatarFallback>
      </Avatar>
      <span className="shrink-0 font-mono text-[11px] text-muted-foreground/70 tabular-nums">
        #{pull.number}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[13px]",
          pull.isDraft && "text-muted-foreground"
        )}
      >
        {pull.title}
      </span>
      {pull.isDraft ? (
        <span className="shrink-0 text-[11px] text-muted-foreground/60">
          draft
        </span>
      ) : null}
      {pull.state === "open" ? null : (
        <span className="shrink-0 text-[11px] text-muted-foreground/60">
          {pull.state}
        </span>
      )}
      <ReviewerStack reviewers={pull.reviewers} />
      <ScoreSlot pull={pull} />
      <CiSlot pull={pull} />
      <SizeTicks pull={pull} />
      <SignalTip
        className="w-7 shrink-0 text-right text-[11px] text-muted-foreground/60 tabular-nums"
        label={`Updated ${fullDate(pull.updatedAt)}`}
      >
        {shortAge(pull.updatedAt, now)}
      </SignalTip>
    </button>
  );
}
