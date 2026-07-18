import type { ReviewerVerdict } from "@sphynx/schema/review-queue";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@sphynx/ui/components/ui/avatar";
import { cn } from "@sphynx/ui/lib/utils";
import { SignalTip } from "@/components/dashboard/signal-tip";
import { stripBotSuffix } from "@/lib/claims";

const MAX_SHOWN = 4;

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
  const shown = reviewers.slice(0, MAX_SHOWN);
  const hidden = reviewers.slice(MAX_SHOWN);
  return (
    <span className="flex items-center">
      {shown.map((reviewer) => (
        <SignalTip
          className="-ml-1 inline-flex first:ml-0"
          key={reviewer.name}
          label={reviewerLabel(reviewer)}
        >
          <Avatar
            className={cn(
              "size-[18px] rounded-xs ring-1 after:rounded-xs",
              RING_CLASSES[reviewer.state]
            )}
          >
            <AvatarImage
              alt={stripBotSuffix(reviewer.name)}
              className="rounded-xs"
              src={reviewer.avatarUrl ?? undefined}
            />
            <AvatarFallback className="rounded-xs text-[8px]">
              {stripBotSuffix(reviewer.name)[0]}
            </AvatarFallback>
          </Avatar>
        </SignalTip>
      ))}
      {hidden.length > 0 ? (
        <SignalTip
          className="ml-1 text-[10px] text-muted-foreground/60 tabular-nums"
          label={hidden
            .map((reviewer) => stripBotSuffix(reviewer.name))
            .join(", ")}
        >
          +{hidden.length}
        </SignalTip>
      ) : null}
    </span>
  );
}
