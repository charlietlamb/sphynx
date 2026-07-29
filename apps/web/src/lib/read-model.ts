import type {
  PendingReview,
  ReviewThread,
} from "@sphynx/schema/pull-request-comments";
import type {
  Conversation,
  ConversationComment,
} from "@sphynx/schema/pull-request-conversation";
import type {
  PullRequestPatches,
  PullRequestSummary,
} from "@sphynx/schema/pull-requests";
import type {
  Pipeline,
  QueuePull,
  RepoFlow,
} from "@sphynx/schema/review-queue";

/**
 * The Convex read-model queries return values structurally identical to the
 * `@sphynx/schema` contract but as a distinct, mutable-array type. These typed
 * converters give the read model one boundary where a Convex result becomes the
 * canonical schema type the components consume, instead of scattered casts. The
 * runtime value is unchanged — only the nominal type.
 */
export const asPipeline = (value: unknown): Pipeline => value as Pipeline;

export const asRepoFlows = (value: unknown): readonly RepoFlow[] =>
  value as readonly RepoFlow[];

export const asQueuePulls = (value: unknown): readonly QueuePull[] =>
  value as readonly QueuePull[];

/**
 * The PR-page reads run as Convex actions returning opaque (`v.any()`) results —
 * the GitHub-normalized shapes are already the canonical schema types, but cross
 * the boundary as `unknown`. These converters name that boundary in one place
 * rather than casting at every call site.
 */
export const asPullSummary = (value: unknown): PullRequestSummary =>
  value as PullRequestSummary;

export const asPullPatches = (value: unknown): PullRequestPatches =>
  value as PullRequestPatches;

export const asConversation = (value: unknown): Conversation =>
  value as Conversation;

export const asConversationComment = (value: unknown): ConversationComment =>
  value as ConversationComment;

export const asReviewThreads = (value: unknown): readonly ReviewThread[] =>
  value as readonly ReviewThread[];

export const asPendingReview = (value: unknown): PendingReview =>
  value as PendingReview;
