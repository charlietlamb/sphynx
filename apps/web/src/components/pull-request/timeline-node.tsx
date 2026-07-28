import {
  ChatCircleIcon,
  GitCommitIcon,
  GitMergeIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import type { GitHubUser } from "@sphynx/schema/pull-requests";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@sphynx/ui/components/ui/avatar";
import { cn } from "@sphynx/ui/lib/utils";
import type { ReactNode } from "react";
import type { FeedItem } from "@/components/pull-request/conversation-feed";
import { EVENT_ICONS } from "@/components/pull-request/event-icons";

interface TimelineNode {
  node: ReactNode;
  variant: "card" | "row";
}

export function avatarNode(author: GitHubUser | null): ReactNode {
  return (
    <Avatar className="size-7 overflow-hidden ring-4 ring-card" size="sm">
      <AvatarImage alt={author?.login ?? "unknown"} src={author?.avatarUrl} />
      <AvatarFallback className="text-[11px]">
        {author?.login?.[0]?.toUpperCase() ?? "?"}
      </AvatarFallback>
    </Avatar>
  );
}

function dotNode(icon: ReactNode, tone?: string): ReactNode {
  return (
    <span
      className={cn(
        "flex size-[18px] items-center justify-center rounded-full ring-4 ring-card [&_svg]:size-2.5",
        tone ?? "bg-muted text-muted-foreground/60"
      )}
    >
      {icon}
    </span>
  );
}

export function timelineNode(item: FeedItem): TimelineNode {
  switch (item.kind) {
    case "comment":
      return { node: avatarNode(item.comment.author), variant: "card" };
    case "review":
      return { node: avatarNode(item.review.author), variant: "card" };
    case "thread":
      return {
        node: dotNode(
          <ChatCircleIcon weight="fill" />,
          "bg-primary/12 text-primary"
        ),
        variant: "card",
      };
    case "event":
      return {
        node: dotNode(
          item.event.kind === "commit" ? (
            <GitCommitIcon weight="fill" />
          ) : (
            EVENT_ICONS[item.event.kind]
          )
        ),
        variant: "row",
      };
    default:
      return {
        node: dotNode(
          item.state === "merged" ? (
            <GitMergeIcon weight="fill" />
          ) : (
            <XCircleIcon weight="fill" />
          ),
          item.state === "merged"
            ? "bg-primary/12 text-primary"
            : "bg-deletion/12 text-deletion"
        ),
        variant: "row",
      };
  }
}
