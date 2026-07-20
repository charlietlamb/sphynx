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
  verb: ReactNode;
}

export function ConversationCardHeader({
  at,
  author,
  githubUrl,
  now,
  verb,
}: ConversationCardHeaderProps) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground text-xs">
      <Avatar size="sm">
        <AvatarImage alt={author?.login ?? "unknown"} src={author?.avatarUrl} />
        <AvatarFallback>{author?.login[0] ?? "?"}</AvatarFallback>
      </Avatar>
      <span className="font-medium text-foreground">
        {author?.login ?? "unknown"}
      </span>
      <span>{verb}</span>
      {githubUrl ? (
        <a
          className="ml-auto hover:text-foreground hover:underline"
          href={githubUrl}
          rel="noreferrer"
          target="_blank"
          title={fullDate(at)}
        >
          {shortAge(at, now)}
        </a>
      ) : (
        <span className="ml-auto" title={fullDate(at)}>
          {shortAge(at, now)}
        </span>
      )}
    </div>
  );
}
