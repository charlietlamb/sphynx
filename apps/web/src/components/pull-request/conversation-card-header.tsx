import type { GitHubUser } from "@sphynx/schema/pull-requests";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@sphynx/ui/components/ui/avatar";
import type { ReactNode } from "react";
import { fullDate, shortAge } from "@/lib/age";

interface ConversationCardHeaderProps {
  at: string;
  author: GitHubUser | null;
  githubUrl: string;
  now: number;
  /** Hidden when the author avatar is drawn on the timeline rail instead. */
  showAvatar?: boolean;
  verb: ReactNode;
}

export function ConversationCardHeader({
  at,
  author,
  githubUrl,
  now,
  verb,
  showAvatar = true,
}: ConversationCardHeaderProps) {
  return (
    <div className="flex items-baseline gap-1.5 text-muted-foreground text-xs">
      {showAvatar ? (
        <Avatar className="self-center" size="sm">
          <AvatarImage
            alt={author?.login ?? "unknown"}
            src={author?.avatarUrl}
          />
          <AvatarFallback>{author?.login[0] ?? "?"}</AvatarFallback>
        </Avatar>
      ) : null}
      <span className="font-semibold text-[13px] text-foreground">
        {author?.login ?? "unknown"}
      </span>
      <span>{verb}</span>
      {githubUrl ? (
        <a
          className="ml-auto text-[11px] text-muted-foreground/50 tabular-nums transition-colors hover:text-foreground"
          href={githubUrl}
          rel="noreferrer"
          target="_blank"
          title={fullDate(at)}
        >
          {shortAge(at, now)}
        </a>
      ) : (
        <span
          className="ml-auto text-[11px] text-muted-foreground/50 tabular-nums"
          title={fullDate(at)}
        >
          {shortAge(at, now)}
        </span>
      )}
    </div>
  );
}
