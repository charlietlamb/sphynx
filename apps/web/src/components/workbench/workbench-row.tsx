import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@sphynx/ui/components/ui/avatar";
import { cn } from "@sphynx/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { SignalTip } from "@/components/dashboard/signal-tip";
import { SphynxMark } from "@/components/layout/sphynx-mark";
import {
  actorLabel,
  type MergedWorkbenchEvent,
  WORKBENCH_GLYPHS,
  WORKBENCH_VERBS,
} from "@/components/workbench/workbench-copy";
import { fullDate, shortAge } from "@/lib/age";

interface WorkbenchRowProps {
  event: MergedWorkbenchEvent;
  now: number;
  owner: string;
  repo: string;
}

const ROW_CLASS =
  "flex h-9 w-full items-center gap-2.5 rounded-md border border-transparent px-2.5 text-left transition-colors hover:bg-alpha-4";

function RowShell({
  children,
  event,
  owner,
  repo,
}: WorkbenchRowProps & { children: ReactNode }) {
  if (event.pull) {
    return (
      <Link
        className={ROW_CLASS}
        params={{ owner, repo, number: event.pull.number }}
        to="/$owner/$repo/pull/$number"
      >
        {children}
      </Link>
    );
  }
  if (event.url) {
    return (
      <a
        className={ROW_CLASS}
        href={event.url}
        rel="noreferrer"
        target="_blank"
      >
        {children}
      </a>
    );
  }
  return (
    <div className={cn(ROW_CLASS, "hover:bg-transparent")}>{children}</div>
  );
}

export function WorkbenchRow(props: WorkbenchRowProps) {
  const { event, now } = props;
  return (
    <RowShell {...props}>
      <span
        aria-hidden
        className={cn(
          "size-[5px] shrink-0 rounded-[1.5px]",
          WORKBENCH_GLYPHS[event.kind]
        )}
      />
      {event.source === "sphynx" ? (
        <span className="flex size-[18px] shrink-0 items-center justify-center rounded-[5px] bg-primary/10 ring-1 ring-primary/30">
          <SphynxMark className="size-2.5" />
        </span>
      ) : (
        <Avatar className="size-[18px] shrink-0 rounded-[5px] ring-1 ring-border after:rounded-[5px]">
          <AvatarImage
            alt={event.actor?.login ?? "unknown"}
            className="rounded-[5px]"
            src={event.actor?.avatarUrl ?? undefined}
          />
          <AvatarFallback className="rounded-[5px] text-[8px]">
            {event.actor?.login[0] ?? "?"}
          </AvatarFallback>
        </Avatar>
      )}
      <span className="shrink-0 text-[12px]">{actorLabel(event)}</span>
      <span className="shrink-0 text-[12px] text-muted-foreground">
        {WORKBENCH_VERBS[event.kind]}
      </span>
      {event.pull ? (
        <>
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground/70 tabular-nums">
            #{event.pull.number}
          </span>
          <span className="min-w-0 flex-1 truncate text-[12px]">
            {event.pull.title}
          </span>
        </>
      ) : (
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
          {event.detail}
        </span>
      )}
      {event.pull && event.detail ? (
        <span className="hidden max-w-48 shrink-0 truncate font-mono text-[11px] text-muted-foreground/60 lg:inline">
          {event.detail}
        </span>
      ) : null}
      <SignalTip
        className="ml-auto w-7 shrink-0 text-right text-[11px] text-muted-foreground/60 tabular-nums"
        label={`${fullDate(event.at)}${event.source === "sphynx" ? " · done in Sphynx" : ""}`}
      >
        {shortAge(event.at, now)}
      </SignalTip>
    </RowShell>
  );
}
