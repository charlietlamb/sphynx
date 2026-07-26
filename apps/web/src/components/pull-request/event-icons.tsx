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
import type { ConversationEventKind } from "@sphynx/schema/pull-request-conversation";
import type { ReactNode } from "react";

export const EVENT_ICONS: Record<
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
