import { GitMergeIcon, XCircleIcon } from "@phosphor-icons/react";
import { fullDate, shortAge } from "@/lib/age";

interface ConversationStateRowProps {
  at: string;
  now: number;
  state: "merged" | "closed";
}

export function ConversationStateRow({
  at,
  now,
  state,
}: ConversationStateRowProps) {
  return (
    <div className="flex items-center gap-2 px-3.5 text-[11px] text-muted-foreground">
      {state === "merged" ? (
        <GitMergeIcon
          className="size-3.5 text-muted-foreground"
          weight="fill"
        />
      ) : (
        <XCircleIcon className="size-3.5 text-deletion" weight="fill" />
      )}
      <span>
        This pull request was {state === "merged" ? "merged" : "closed"}
      </span>
      <span
        className="ml-auto shrink-0 text-muted-foreground/60 tabular-nums"
        title={fullDate(at)}
      >
        {shortAge(at, now)}
      </span>
    </div>
  );
}
