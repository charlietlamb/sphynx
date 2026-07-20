import type { ReviewThread } from "@sphynx/schema/pull-request-comments";
import type { ThreadCommenting } from "@/components/pull-request/comment-thread";
import { ConversationCommentCard } from "@/components/pull-request/conversation-comment-card";
import { ConversationCommitGroup } from "@/components/pull-request/conversation-commit-group";
import { ConversationEventRow } from "@/components/pull-request/conversation-event-row";
import {
  type FeedItem,
  feedKey,
} from "@/components/pull-request/conversation-feed";
import { ConversationReviewCard } from "@/components/pull-request/conversation-review-card";
import { ConversationStateRow } from "@/components/pull-request/conversation-state-row";
import { ConversationThreadItem } from "@/components/pull-request/conversation-thread-item";
import { patchLineText } from "@/components/pull-request/patch-lines";
import type { PatchMap } from "@/components/pull-request/patch-map";

interface ConversationFeedItemProps {
  commenting: ThreadCommenting;
  focusedThreadKey: string | null;
  item: FeedItem;
  now: number;
  onToggleFocus: (key: string) => void;
  patches: PatchMap;
}

export function ConversationFeedItem({
  commenting,
  focusedThreadKey,
  item,
  now,
  onToggleFocus,
  patches,
}: ConversationFeedItemProps) {
  switch (item.kind) {
    case "comment":
      return <ConversationCommentCard comment={item.comment} now={now} />;
    case "review":
      return <ConversationReviewCard now={now} review={item.review} />;
    case "thread": {
      const patch = patches.get(item.thread.path) ?? null;
      const key = feedKey(item);
      return (
        <ConversationThreadItem
          commenting={commenting}
          focused={key === focusedThreadKey}
          onToggleFocus={() => onToggleFocus(key)}
          originalLines={threadLines(patch, item.thread)}
          thread={item.thread}
        />
      );
    }
    case "commits":
      return <ConversationCommitGroup commits={item.commits} now={now} />;
    case "event":
      return <ConversationEventRow event={item.event} now={now} />;
    default:
      return <ConversationStateRow at={item.at} now={now} state={item.state} />;
  }
}

function threadLines(patch: string | null, thread: ReviewThread) {
  if (!patch) {
    return [];
  }
  return patchLineText(patch, thread.startLine ?? thread.line, thread.line);
}
