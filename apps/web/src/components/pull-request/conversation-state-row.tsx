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
    <div className="flex w-full items-center gap-2 text-[11px] text-muted-foreground">
      <span className="font-medium text-foreground">
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
