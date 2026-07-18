import type { QueuePull } from "@sphynx/schema/review-queue";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@sphynx/ui/components/ui/avatar";
import { cn } from "@sphynx/ui/lib/utils";
import { CiSlot } from "@/components/dashboard/ci-slot";
import { ReviewerStack } from "@/components/dashboard/reviewer-stack";
import { ScoreSlot } from "@/components/dashboard/score-slot";
import { SizeTicks } from "@/components/dashboard/size-ticks";
import { shortAge } from "@/lib/age";

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
          : "border-transparent hover:bg-alpha-2"
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
        <span className="shrink-0 text-[11px] text-muted-foreground/60">
          draft
        </span>
      ) : null}
      <ReviewerStack reviewers={pull.reviewers} />
      <ScoreSlot pull={pull} />
      <CiSlot pull={pull} />
      <SizeTicks pull={pull} />
      <span className="w-7 shrink-0 text-right text-[11px] text-muted-foreground/60 tabular-nums">
        {shortAge(pull.updatedAt, now)}
      </span>
    </button>
  );
}
