import type { ReviewThread } from "@sphynx/schema/pull-request-comments";
import type {
  Conversation,
  ConversationComment,
  ConversationEvent,
  ConversationReview,
} from "@sphynx/schema/pull-request-conversation";
import type { PullRequestSummary } from "@sphynx/schema/pull-requests";

export type FeedItem =
  | { kind: "comment"; at: string; comment: ConversationComment }
  | { kind: "review"; at: string; review: ConversationReview }
  | { kind: "thread"; at: string; thread: ReviewThread }
  | { kind: "commits"; at: string; commits: ConversationEvent[] }
  | { kind: "event"; at: string; event: ConversationEvent }
  | { kind: "state"; at: string; state: "merged" | "closed" };

function mergeAdjacentCommits(items: FeedItem[]) {
  const merged: FeedItem[] = [];
  for (const item of items) {
    const previous = merged.at(-1);
    if (
      item.kind === "event" &&
      item.event.kind === "commit" &&
      previous?.kind === "commits"
    ) {
      previous.commits.push(item.event);
      continue;
    }
    if (item.kind === "event" && item.event.kind === "commit") {
      merged.push({ kind: "commits", at: item.at, commits: [item.event] });
      continue;
    }
    merged.push(item);
  }
  return merged;
}

export function feedKey(item: FeedItem) {
  switch (item.kind) {
    case "comment":
      return `comment-${item.comment.id}`;
    case "review":
      return `review-${item.review.id}`;
    case "thread":
      return `thread-${
        item.thread.id ?? `${item.thread.path}:${item.thread.line}:${item.at}`
      }`;
    case "commits":
      return `commits-${item.commits[0]?.id ?? item.at}`;
    case "event":
      return `event-${item.event.id}`;
    default:
      return `state-${item.state}`;
  }
}

export function latestVerdicts(
  reviews: readonly ConversationReview[]
): ConversationReview[] {
  const byReviewer = new Map<string, ConversationReview>();
  for (const review of reviews) {
    const login = review.author?.login;
    if (!login) {
      continue;
    }
    const current = byReviewer.get(login);
    if (!current || review.submittedAt > current.submittedAt) {
      byReviewer.set(login, review);
    }
  }
  return [...byReviewer.values()].sort((a, b) =>
    a.submittedAt.localeCompare(b.submittedAt)
  );
}

export function buildConversationFeed(
  summary: PullRequestSummary,
  conversation: Conversation,
  threads: readonly ReviewThread[]
): FeedItem[] {
  const items: FeedItem[] = [
    ...conversation.comments.map(
      (comment): FeedItem => ({
        kind: "comment",
        at: comment.createdAt,
        comment,
      })
    ),
    ...conversation.reviews.map(
      (review): FeedItem => ({ kind: "review", at: review.submittedAt, review })
    ),
    ...threads.flatMap((thread): FeedItem[] => {
      const first = thread.comments[0];
      return first ? [{ kind: "thread", at: first.createdAt, thread }] : [];
    }),
    ...conversation.events.map(
      (event): FeedItem => ({ kind: "event", at: event.at, event })
    ),
  ];
  const hasMergedEvent = conversation.events.some(
    (event) => event.kind === "merged"
  );
  const hasClosedEvent = conversation.events.some(
    (event) => event.kind === "closed"
  );
  if (summary.state === "merged" && summary.mergedAt && !hasMergedEvent) {
    items.push({ kind: "state", at: summary.mergedAt, state: "merged" });
  }
  if (summary.state === "closed" && !hasClosedEvent) {
    items.push({ kind: "state", at: summary.updatedAt, state: "closed" });
  }
  const ordered = items
    .map((item, index) => {
      const parsed = Date.parse(item.at);
      return {
        item,
        index,
        time: Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed,
      };
    })
    .sort((a, b) => (a.time === b.time ? a.index - b.index : a.time - b.time))
    .map((entry) => entry.item);
  return mergeAdjacentCommits(ordered);
}
