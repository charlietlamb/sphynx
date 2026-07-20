import {
  ArrowCounterClockwiseIcon,
  ArrowsClockwiseIcon,
  EyeIcon,
  GitMergeIcon,
  PencilSimpleIcon,
  TagIcon,
  UserPlusIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import type {
  ConversationEvent,
  ConversationEventKind,
} from "@sphynx/schema/pull-request-conversation";
import type { ReactNode } from "react";
import { fullDate, shortAge } from "@/lib/age";

const EVENT_ICONS: Record<
  Exclude<ConversationEventKind, "commit">,
  ReactNode
> = {
  "force-push": (
    <ArrowsClockwiseIcon
      className="size-3.5 text-muted-foreground"
      weight="fill"
    />
  ),
  labeled: <TagIcon className="size-3.5 text-muted-foreground" weight="fill" />,
  unlabeled: (
    <TagIcon className="size-3.5 text-muted-foreground" weight="fill" />
  ),
  "review-requested": (
    <EyeIcon className="size-3.5 text-muted-foreground" weight="fill" />
  ),
  assigned: (
    <UserPlusIcon className="size-3.5 text-muted-foreground" weight="fill" />
  ),
  merged: (
    <GitMergeIcon className="size-3.5 text-muted-foreground" weight="fill" />
  ),
  closed: <XCircleIcon className="size-3.5 text-deletion" weight="fill" />,
  reopened: (
    <ArrowCounterClockwiseIcon
      className="size-3.5 text-addition"
      weight="fill"
    />
  ),
  renamed: (
    <PencilSimpleIcon
      className="size-3.5 text-muted-foreground"
      weight="fill"
    />
  ),
};

function eventPhrase(event: ConversationEvent): ReactNode {
  switch (event.kind) {
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
  if (event.kind === "commit") {
    return null;
  }
  return (
    <div className="flex items-center gap-2 px-3.5 text-[11px] text-muted-foreground">
      {EVENT_ICONS[event.kind]}
      {event.actor ? (
        <span className="font-medium text-foreground">{event.actor.login}</span>
      ) : null}
      <span className="min-w-0 truncate">{eventPhrase(event)}</span>
      <span
        className="ml-auto shrink-0 text-muted-foreground/60 tabular-nums"
        title={fullDate(event.at)}
      >
        {shortAge(event.at, now)}
      </span>
    </div>
  );
}
