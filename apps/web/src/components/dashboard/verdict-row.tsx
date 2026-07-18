import type { ReviewerVerdict } from "@sphynx/schema/review-queue";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@sphynx/ui/components/ui/avatar";
import { cn } from "@sphynx/ui/lib/utils";
import { shortAge } from "@/lib/age";
import { stripBotSuffix } from "@/lib/claims";

const VERDICT_LABELS: Record<
  ReviewerVerdict["state"],
  { label: string; className: string }
> = {
  approved: { label: "approved", className: "text-addition" },
  "changes-requested": { label: "wants changes", className: "text-deletion" },
  commented: { label: "commented", className: "text-muted-foreground" },
};

interface VerdictRowProps {
  now: number;
  reviewer: ReviewerVerdict;
}

export function VerdictRow({ now, reviewer }: VerdictRowProps) {
  const verdict = VERDICT_LABELS[reviewer.state];
  const name = stripBotSuffix(reviewer.name);
  return (
    <div className="flex h-9 items-center gap-2.5">
      <Avatar className="size-5 shrink-0 rounded-full">
        <AvatarImage
          alt={name}
          className="rounded-full"
          src={reviewer.avatarUrl ?? undefined}
        />
        <AvatarFallback className="rounded-full text-[9px]">
          {name[0]}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1 truncate text-[13px]">{name}</span>
      {reviewer.kind === "bot" ? (
        <span className="shrink-0 font-medium text-[10px] text-muted-foreground/70">
          bot
        </span>
      ) : null}
      {reviewer.score ? (
        <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
          {reviewer.score}
        </span>
      ) : null}
      <span className={cn("shrink-0 text-[12px]", verdict.className)}>
        {verdict.label}
      </span>
      <span className="w-7 shrink-0 text-right text-[11px] text-muted-foreground/60 tabular-nums">
        {reviewer.submittedAt ? shortAge(reviewer.submittedAt, now) : ""}
      </span>
    </div>
  );
}
