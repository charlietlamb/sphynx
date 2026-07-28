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
  "force-push": <ArrowsClockwiseIcon weight="fill" />,
  labeled: <TagIcon weight="fill" />,
  unlabeled: <TagIcon weight="fill" />,
  "review-requested": <EyeIcon weight="fill" />,
  assigned: <UserPlusIcon weight="fill" />,
  merged: <GitMergeIcon weight="fill" />,
  closed: <XCircleIcon weight="fill" />,
  reopened: <ArrowCounterClockwiseIcon weight="fill" />,
  renamed: <PencilSimpleIcon weight="fill" />,
};
