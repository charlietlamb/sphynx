import type {
  ReviewComment,
  ReviewThread,
} from "@sphynx/schema/pull-request-comments";
import type { RawReviewComment } from "./rest-schemas";

const toReviewComment = (raw: RawReviewComment): ReviewComment => ({
  id: raw.id,
  body: raw.body,
  author: raw.user
    ? { login: raw.user.login, avatarUrl: raw.user.avatar_url }
    : null,
  createdAt: raw.created_at,
  githubUrl: raw.html_url,
  pending: false,
});

const toReviewThread = (raw: RawReviewComment): ReviewThread | null => {
  if (raw.line === null) {
    return null;
  }
  return {
    id: null,
    path: raw.path,
    line: raw.line,
    side: raw.side === "LEFT" ? "deletions" : "additions",
    startLine: raw.start_line ?? null,
    isResolved: false,
    isOutdated: false,
    viewerCanResolve: false,
    comments: [toReviewComment(raw)],
  };
};

export const groupReviewThreads = (
  comments: readonly RawReviewComment[]
): ReviewThread[] => {
  const threads = new Map<number, ReviewThread>();
  for (const comment of comments) {
    const parentId = comment.in_reply_to_id;
    const parent = parentId === undefined ? undefined : threads.get(parentId);
    if (parentId !== undefined && parent) {
      threads.set(parentId, {
        ...parent,
        comments: [...parent.comments, toReviewComment(comment)],
      });
      continue;
    }
    const thread = toReviewThread(comment);
    if (thread) {
      threads.set(comment.id, thread);
    }
  }
  return [...threads.values()];
};
