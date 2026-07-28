import type { ConversationEvent } from "@sphynx/schema/pull-request-conversation";
import type { ReactNode } from "react";
import { fullDate, shortAge } from "@/lib/age";

function eventPhrase(event: ConversationEvent): ReactNode {
  switch (event.kind) {
    case "commit":
      return (
        <span className="flex min-w-0 items-center gap-2">
          {event.url ? (
            <a
              className="shrink-0 font-mono text-[11px] text-muted-foreground/70 hover:text-foreground hover:underline"
              href={event.url}
              rel="noreferrer"
              target="_blank"
            >
              {event.ref}
            </a>
          ) : (
            <span className="shrink-0 font-mono text-[11px] text-muted-foreground/70">
              {event.ref}
            </span>
          )}
          <span className="min-w-0 truncate text-foreground/90">
            {event.detail}
          </span>
        </span>
      );
    case "force-push":
      return (
        <>
          force-pushed to{" "}
          {event.ref ? <Oid>{event.ref}</Oid> : "the head branch"}
        </>
      );
    case "labeled":
      return <>added the {event.detail ?? "unknown"} label</>;
    case "unlabeled":
      return <>removed the {event.detail ?? "unknown"} label</>;
    case "review-requested":
      return (
        <>
          requested a review
          {event.detail ? (
            <>
              {" "}
              from <Actor>{event.detail}</Actor>
            </>
          ) : null}
        </>
      );
    case "assigned":
      return (
        <>
          assigned{" "}
          {event.detail ? <Actor>{event.detail}</Actor> : "this pull request"}
        </>
      );
    case "merged":
      return (
        <>
          merged this pull request
          {event.ref ? (
            <>
              {" "}
              with <Oid>{event.ref}</Oid>
            </>
          ) : null}
        </>
      );
    case "closed":
      return "closed this pull request";
    case "reopened":
      return "reopened this pull request";
    case "renamed":
      return (
        <>
          changed the title to{" "}
          <span className="text-foreground">{event.detail}</span>
        </>
      );
    default:
      return event.detail;
  }
}

function Oid({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[11px] text-foreground/90">{children}</span>
  );
}

function Actor({ children }: { children: ReactNode }) {
  return <span className="text-foreground">{children}</span>;
}

interface ConversationEventRowProps {
  event: ConversationEvent;
  now: number;
}

export function ConversationEventRow({
  event,
  now,
}: ConversationEventRowProps) {
  const isCommit = event.kind === "commit";
  return (
    <div className="flex w-full min-w-0 items-center gap-2 text-[12px] text-muted-foreground/70">
      {!isCommit && event.actor ? (
        <span className="font-medium text-foreground/80">
          {event.actor.login}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 items-center gap-2 truncate">
        {eventPhrase(event)}
      </span>
      <span
        className="ml-auto shrink-0 text-[11px] text-muted-foreground/40 tabular-nums"
        title={fullDate(event.at)}
      >
        {shortAge(event.at, now)}
      </span>
    </div>
  );
}
