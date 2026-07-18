import type { ReviewerVerdict } from "@sphynx/schema/review-queue";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@sphynx/ui/components/ui/avatar";
import { cn } from "@sphynx/ui/lib/utils";

const MAX_SHOWN = 4;

const RING_CLASSES: Record<ReviewerVerdict["state"], string> = {
  approved: "ring-addition",
  "changes-requested": "ring-deletion",
  commented: "ring-border",
};

const BOT_NAME_SUFFIX = /\[bot\]$/;

export function ReviewerStack({
  reviewers,
}: {
  reviewers: readonly ReviewerVerdict[];
}) {
  const shown = reviewers.slice(0, MAX_SHOWN);
  const hidden = reviewers.length - shown.length;
  return (
    <span className="flex items-center">
      {shown.map((reviewer) => {
        const name = reviewer.name.replace(BOT_NAME_SUFFIX, "");
        return (
          <Avatar
            className={cn(
              "-ml-1 size-[18px] rounded-full ring-1 first:ml-0",
              RING_CLASSES[reviewer.state]
            )}
            key={reviewer.name}
            title={`${name} · ${reviewer.state}${reviewer.score ? ` · ${reviewer.score}` : ""}`}
          >
            <AvatarImage
              alt={name}
              className="rounded-full"
              src={reviewer.avatarUrl ?? undefined}
            />
            <AvatarFallback className="rounded-full text-[8px]">
              {name[0]}
            </AvatarFallback>
          </Avatar>
        );
      })}
      {hidden > 0 ? (
        <span className="ml-1 font-mono text-[10px] text-muted-foreground/60 tabular-nums">
          +{hidden}
        </span>
      ) : null}
    </span>
  );
}
