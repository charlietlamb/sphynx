import type { ReviewerVerdict } from "@sphynx/schema/review-queue";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@sphynx/ui/components/ui/avatar";
import { cn } from "@sphynx/ui/lib/utils";
import { SignalTip } from "@/components/dashboard/signal-tip";
import { stripBotSuffix } from "@/lib/claims";

const MAX_SHOWN = 3;

const RING_CLASSES: Record<ReviewerVerdict["state"], string> = {
  approved: "ring-addition",
  "changes-requested": "ring-deletion",
  commented: "ring-border",
};

const VERDICT_LABELS: Record<ReviewerVerdict["state"], string> = {
  approved: "approved",
  "changes-requested": "requested changes",
  commented: "commented",
};

function reviewerLabel(reviewer: ReviewerVerdict) {
  const verdict = `${stripBotSuffix(reviewer.name)} ${VERDICT_LABELS[reviewer.state]}`;
  return reviewer.score ? `${verdict} · ${reviewer.score}` : verdict;
}

export function ReviewerStack({
  reviewers,
}: {
  reviewers: readonly ReviewerVerdict[];
}) {
  const shown =
    reviewers.length > MAX_SHOWN
      ? reviewers.slice(0, MAX_SHOWN - 1)
      : reviewers;
  const hidden = reviewers.slice(shown.length);
  return (
    <span className="flex items-center">
      {shown.map((reviewer) => (
        <SignalTip
          className="ml-[3px] inline-flex first:ml-0"
          key={reviewer.name}
          label={reviewerLabel(reviewer)}
        >
          <Avatar
            className={cn(
              "size-[18px] rounded-[5px] ring-1 after:rounded-[5px]",
              RING_CLASSES[reviewer.state]
            )}
          >
            <AvatarImage
              alt={stripBotSuffix(reviewer.name)}
              className="rounded-[5px]"
              src={reviewer.avatarUrl ?? undefined}
            />
            <AvatarFallback className="rounded-[5px] text-[8px]">
              {stripBotSuffix(reviewer.name)[0]}
            </AvatarFallback>
          </Avatar>
        </SignalTip>
      ))}
      {hidden.length > 0 ? (
        <SignalTip
          className="ml-[3px] inline-flex size-[18px] items-center justify-center rounded-[5px] bg-muted/60 font-medium text-[9px] text-muted-foreground tabular-nums ring-1 ring-border"
          label={
            <span className="flex flex-col gap-0.5">
              {hidden.map((reviewer) => (
                <span key={reviewer.name}>{reviewerLabel(reviewer)}</span>
              ))}
            </span>
          }
        >
          +{hidden.length}
        </SignalTip>
      ) : null}
    </span>
  );
}
