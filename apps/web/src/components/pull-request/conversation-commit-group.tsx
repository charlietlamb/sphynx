import { GitCommitIcon } from "@phosphor-icons/react";
import type { ConversationEvent } from "@sphynx/schema/pull-request-conversation";
import { fullDate, shortAge } from "@/lib/age";
import { plural } from "@/lib/claims";

interface ConversationCommitGroupProps {
  commits: readonly ConversationEvent[];
  now: number;
}

export function ConversationCommitGroup({
  commits,
  now,
}: ConversationCommitGroupProps) {
  const first = commits[0];
  if (!first) {
    return null;
  }
  const last = commits.at(-1) ?? first;
  return (
    <div className="flex flex-col gap-1.5 px-3.5 text-[11px] text-muted-foreground">
      <div className="flex items-center gap-2">
        <GitCommitIcon
          className="size-3.5 text-muted-foreground"
          weight="fill"
        />
        {first.actor ? (
          <span className="font-medium text-foreground">
            {first.actor.login}
          </span>
        ) : null}
        <span>added {plural(commits.length, "commit")}</span>
        <span
          className="ml-auto shrink-0 text-muted-foreground/60 tabular-nums"
          title={fullDate(last.at)}
        >
          {shortAge(last.at, now)}
        </span>
      </div>
      <div className="flex flex-col gap-1 pl-[22px]">
        {commits.map((commit) => (
          <div className="flex min-w-0 items-center gap-2" key={commit.id}>
            {commit.url ? (
              <a
                className="shrink-0 font-mono text-[11px] text-muted-foreground/70 hover:text-foreground hover:underline"
                href={commit.url}
                rel="noreferrer"
                target="_blank"
              >
                {commit.ref}
              </a>
            ) : (
              <span className="shrink-0 font-mono text-[11px] text-muted-foreground/70">
                {commit.ref}
              </span>
            )}
            <span className="min-w-0 truncate">{commit.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
