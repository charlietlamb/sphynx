import type { QueuePull } from "@sphynx/schema/review-queue";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@sphynx/ui/components/ui/avatar";
import { cn } from "@sphynx/ui/lib/utils";
import { ReviewerStack } from "@/components/dashboard/reviewer-stack";
import { ScoreChip } from "@/components/dashboard/score-chip";
import { sizeClass } from "@/lib/attention";

const CI_COLORS: Record<QueuePull["ci"], string> = {
  success: "var(--addition)",
  failure: "var(--deletion)",
  pending: "var(--color-amber-500)",
  none: "color-mix(in oklab, var(--muted-foreground) 35%, transparent)",
};

const AGE_STEPS: readonly [number, string][] = [
  [60, "m"],
  [24, "h"],
  [365, "d"],
];

function shortAge(iso: string, now: number) {
  let value = Math.max(1, Math.round((now - new Date(iso).getTime()) / 60_000));
  for (const [limit, unit] of AGE_STEPS) {
    if (value < limit) {
      return `${value}${unit}`;
    }
    value = Math.round(value / limit);
  }
  return `${value}y`;
}

interface QueueRowProps {
  focused: boolean;
  now: number;
  onFocus: () => void;
  onOpen: () => void;
  pull: QueuePull;
}

export function QueueRow({
  focused,
  now,
  onFocus,
  onOpen,
  pull,
}: QueueRowProps) {
  return (
    <button
      className={cn(
        "relative flex h-10 w-full items-center gap-2.5 rounded-md border px-2.5 text-left transition-colors",
        focused
          ? "border-primary bg-primary/10"
          : "border-transparent hover:bg-muted/30"
      )}
      onClick={onFocus}
      onDoubleClick={onOpen}
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
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground/60">
          draft
        </span>
      ) : null}
      <ReviewerStack reviewers={pull.reviewers} />
      <ScoreChip pull={pull} />
      <span className="w-5 shrink-0 text-right font-mono text-[10px] text-muted-foreground/70 uppercase">
        {sizeClass(pull)}
      </span>
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full"
        style={{ background: CI_COLORS[pull.ci] }}
        title={`checks ${pull.ci}`}
      />
      <span className="w-7 shrink-0 text-right font-mono text-[11px] text-muted-foreground/70 tabular-nums">
        {shortAge(pull.updatedAt, now)}
      </span>
    </button>
  );
}
