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
import type { ReactNode } from "react";
import type { FeedItem } from "@/components/pull-request/conversation-feed";
import { EVENT_ICONS } from "@/components/pull-request/event-icons";

interface TimelineNode {
  node: ReactNode;
  variant: "card" | "row";
}

export function avatarNode(author: GitHubUser | null): ReactNode {
  return (
    <Avatar className="size-7 overflow-hidden ring-4 ring-background" size="sm">
      <AvatarImage alt={author?.login ?? "unknown"} src={author?.avatarUrl} />
      <AvatarFallback className="text-[11px]">
        {author?.login?.[0]?.toUpperCase() ?? "?"}
      </AvatarFallback>
    </Avatar>
  );
}

function iconNode(icon: ReactNode): ReactNode {
  return (
    <span className="flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground ring-4 ring-background">
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
        node: iconNode(<ChatCircleIcon className="size-3.5" weight="fill" />),
        variant: "card",
      };
    case "event":
      return {
        node: iconNode(
          item.event.kind === "commit" ? (
            <GitCommitIcon className="size-3.5" weight="fill" />
          ) : (
            EVENT_ICONS[item.event.kind]
          )
        ),
        variant: "row",
      };
    default:
      return {
        node: iconNode(
          item.state === "merged" ? (
            <GitMergeIcon className="size-3.5 text-primary" weight="fill" />
          ) : (
            <XCircleIcon className="size-3.5 text-deletion" weight="fill" />
          )
        ),
        variant: "row",
      };
  }
}
