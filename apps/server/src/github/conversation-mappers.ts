import type {
  Conversation,
  ConversationComment,
  ConversationEvent,
  ConversationReview,
  ConversationVerdict,
} from "@sphynx/schema/pull-request-conversation";
import { GitHubUserSchema } from "@sphynx/schema/pull-requests";
import { Option, Schema } from "effect";
import type { RawIssueComment } from "./rest-schemas";

export const CONVERSATION_QUERY = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      bodyHTML
      comments(first: 50) {
        nodes {
          id fullDatabaseId body bodyHTML createdAt url
          author { login avatarUrl }
        }
      }
      reviews(first: 50) {
        nodes {
          id fullDatabaseId state body bodyHTML submittedAt url
          author { login avatarUrl }
          comments(first: 1) { totalCount }
        }
      }
      timelineItems(first: 100, itemTypes: [
        PULL_REQUEST_COMMIT, HEAD_REF_FORCE_PUSHED_EVENT, LABELED_EVENT,
        UNLABELED_EVENT, REVIEW_REQUESTED_EVENT, ASSIGNED_EVENT, MERGED_EVENT,
        CLOSED_EVENT, REOPENED_EVENT, RENAMED_TITLE_EVENT
      ]) {
        nodes {
          __typename
          ... on PullRequestCommit {
            id url
            commit {
              abbreviatedOid messageHeadline committedDate
              author { user { login avatarUrl } }
            }
          }
          ... on HeadRefForcePushedEvent {
            id createdAt
            actor { login avatarUrl }
            afterCommit { abbreviatedOid }
          }
          ... on LabeledEvent {
            id createdAt actor { login avatarUrl } label { name }
          }
          ... on UnlabeledEvent {
            id createdAt actor { login avatarUrl } label { name }
          }
          ... on ReviewRequestedEvent {
            id createdAt actor { login avatarUrl }
            requestedReviewer {
              ... on User { login }
              ... on Bot { login }
            }
          }
          ... on AssignedEvent {
            id createdAt actor { login avatarUrl }
            assignee {
              ... on User { login }
              ... on Bot { login }
            }
          }
          ... on MergedEvent {
            id createdAt actor { login avatarUrl } commit { abbreviatedOid }
          }
          ... on ClosedEvent { id createdAt actor { login avatarUrl } }
          ... on ReopenedEvent { id createdAt actor { login avatarUrl } }
          ... on RenamedTitleEvent {
            id createdAt actor { login avatarUrl } currentTitle
          }
        }
      }
    }
  }
}`;

const RawConversationCommentSchema = Schema.Struct({
  id: Schema.String,
  fullDatabaseId: Schema.NullishOr(Schema.String),
  body: Schema.String,
  bodyHTML: Schema.String,
  createdAt: Schema.String,
  url: Schema.String,
  author: Schema.NullishOr(GitHubUserSchema),
});

type RawConversationComment = typeof RawConversationCommentSchema.Type;

const RawConversationReviewSchema = Schema.Struct({
  id: Schema.String,
  fullDatabaseId: Schema.NullishOr(Schema.String),
  state: Schema.String,
  body: Schema.String,
  bodyHTML: Schema.String,
  submittedAt: Schema.NullishOr(Schema.String),
  url: Schema.String,
  author: Schema.NullishOr(GitHubUserSchema),
  comments: Schema.Struct({ totalCount: Schema.Number }),
});

type RawConversationReview = typeof RawConversationReviewSchema.Type;

export const ConversationNodesSchema = Schema.Struct({
  bodyHTML: Schema.NullishOr(Schema.String),
  comments: Schema.Struct({
    nodes: Schema.Array(Schema.NullishOr(RawConversationCommentSchema)),
  }),
  reviews: Schema.Struct({
    nodes: Schema.Array(Schema.NullishOr(RawConversationReviewSchema)),
  }),
  timelineItems: Schema.Struct({
    nodes: Schema.Array(Schema.Unknown),
  }),
});

type ConversationNodes = typeof ConversationNodesSchema.Type;

const eventActor = Schema.NullishOr(GitHubUserSchema);

const RawCommitNodeSchema = Schema.Struct({
  __typename: Schema.Literal("PullRequestCommit"),
  id: Schema.String,
  url: Schema.String,
  commit: Schema.Struct({
    abbreviatedOid: Schema.String,
    messageHeadline: Schema.String,
    committedDate: Schema.String,
    author: Schema.NullishOr(Schema.Struct({ user: eventActor })),
  }),
});

const RawForcePushNodeSchema = Schema.Struct({
  __typename: Schema.Literal("HeadRefForcePushedEvent"),
  id: Schema.String,
  createdAt: Schema.String,
  actor: eventActor,
  afterCommit: Schema.NullishOr(
    Schema.Struct({ abbreviatedOid: Schema.String })
  ),
});

const RawLabelNodeSchema = Schema.Struct({
  __typename: Schema.Literal("LabeledEvent", "UnlabeledEvent"),
  id: Schema.String,
  createdAt: Schema.String,
  actor: eventActor,
  label: Schema.Struct({ name: Schema.String }),
});

const RawReviewRequestNodeSchema = Schema.Struct({
  __typename: Schema.Literal("ReviewRequestedEvent"),
  id: Schema.String,
  createdAt: Schema.String,
  actor: eventActor,
  requestedReviewer: Schema.NullishOr(
    Schema.Struct({
      login: Schema.optional(Schema.String),
      name: Schema.optional(Schema.String),
    })
  ),
});

const RawAssignedNodeSchema = Schema.Struct({
  __typename: Schema.Literal("AssignedEvent"),
  id: Schema.String,
  createdAt: Schema.String,
  actor: eventActor,
  assignee: Schema.NullishOr(
    Schema.Struct({ login: Schema.optional(Schema.String) })
  ),
});

const RawMergedNodeSchema = Schema.Struct({
  __typename: Schema.Literal("MergedEvent"),
  id: Schema.String,
  createdAt: Schema.String,
  actor: eventActor,
  commit: Schema.NullishOr(Schema.Struct({ abbreviatedOid: Schema.String })),
});

const RawStateNodeSchema = Schema.Struct({
  __typename: Schema.Literal("ClosedEvent", "ReopenedEvent"),
  id: Schema.String,
  createdAt: Schema.String,
  actor: eventActor,
});

const RawRenamedNodeSchema = Schema.Struct({
  __typename: Schema.Literal("RenamedTitleEvent"),
  id: Schema.String,
  createdAt: Schema.String,
  actor: eventActor,
  currentTitle: Schema.String,
});

const decodeCommitNode = Schema.decodeUnknownOption(RawCommitNodeSchema);
const decodeForcePushNode = Schema.decodeUnknownOption(RawForcePushNodeSchema);
const decodeLabelNode = Schema.decodeUnknownOption(RawLabelNodeSchema);
const decodeReviewRequestNode = Schema.decodeUnknownOption(
  RawReviewRequestNodeSchema
);
const decodeAssignedNode = Schema.decodeUnknownOption(RawAssignedNodeSchema);
const decodeMergedNode = Schema.decodeUnknownOption(RawMergedNodeSchema);
const decodeStateNode = Schema.decodeUnknownOption(RawStateNodeSchema);
const decodeRenamedNode = Schema.decodeUnknownOption(RawRenamedNodeSchema);

const baseEvent = {
  detail: null,
  ref: null,
  url: null,
};

const mapNode =
  <T>(
    decode: (node: unknown) => Option.Option<T>,
    map: (value: T) => ConversationEvent
  ) =>
  (node: unknown): ConversationEvent | null =>
    Option.match(decode(node), { onNone: () => null, onSome: map });

const EVENT_MAPPERS: ReadonlyArray<
  (node: unknown) => ConversationEvent | null
> = [
  mapNode(decodeCommitNode, (value) => ({
    ...baseEvent,
    id: value.id,
    kind: "commit",
    at: value.commit.committedDate,
    actor: value.commit.author?.user ?? null,
    detail: value.commit.messageHeadline,
    ref: value.commit.abbreviatedOid,
    url: value.url,
  })),
  mapNode(decodeForcePushNode, (value) => ({
    ...baseEvent,
    id: value.id,
    kind: "force-push",
    at: value.createdAt,
    actor: value.actor ?? null,
    ref: value.afterCommit?.abbreviatedOid ?? null,
  })),
  mapNode(decodeLabelNode, (value) => ({
    ...baseEvent,
    id: value.id,
    kind: value.__typename === "LabeledEvent" ? "labeled" : "unlabeled",
    at: value.createdAt,
    actor: value.actor ?? null,
    detail: value.label.name,
  })),
  mapNode(decodeReviewRequestNode, (value) => ({
    ...baseEvent,
    id: value.id,
    kind: "review-requested",
    at: value.createdAt,
    actor: value.actor ?? null,
    detail:
      value.requestedReviewer?.login ?? value.requestedReviewer?.name ?? null,
  })),
  mapNode(decodeAssignedNode, (value) => ({
    ...baseEvent,
    id: value.id,
    kind: "assigned",
    at: value.createdAt,
    actor: value.actor ?? null,
    detail: value.assignee?.login ?? null,
  })),
  mapNode(decodeMergedNode, (value) => ({
    ...baseEvent,
    id: value.id,
    kind: "merged",
    at: value.createdAt,
    actor: value.actor ?? null,
    ref: value.commit?.abbreviatedOid ?? null,
  })),
  mapNode(decodeStateNode, (value) => ({
    ...baseEvent,
    id: value.id,
    kind: value.__typename === "ClosedEvent" ? "closed" : "reopened",
    at: value.createdAt,
    actor: value.actor ?? null,
  })),
  mapNode(decodeRenamedNode, (value) => ({
    ...baseEvent,
    id: value.id,
    kind: "renamed",
    at: value.createdAt,
    actor: value.actor ?? null,
    detail: value.currentTitle,
  })),
];

export function toConversationEvent(node: unknown): ConversationEvent | null {
  for (const mapper of EVENT_MAPPERS) {
    const event = mapper(node);
    if (event) {
      return event;
    }
  }
  return null;
}

const VERDICTS: Record<string, ConversationVerdict> = {
  APPROVED: "approved",
  CHANGES_REQUESTED: "changes-requested",
  COMMENTED: "commented",
  DISMISSED: "dismissed",
};

function toGraphqlComment(
  node: RawConversationComment | null | undefined
): ConversationComment | null {
  if (!node) {
    return null;
  }
  return {
    id: node.fullDatabaseId ?? node.id,
    author: node.author ?? null,
    body: node.body,
    bodyHTML: node.bodyHTML,
    createdAt: node.createdAt,
    githubUrl: node.url,
  };
}

function toGraphqlReview(
  node: RawConversationReview | null | undefined
): ConversationReview | null {
  if (!node) {
    return null;
  }
  const verdict = VERDICTS[node.state];
  if (!verdict || node.submittedAt === null || node.submittedAt === undefined) {
    return null;
  }
  const commentCount = node.comments.totalCount;
  if (
    verdict === "commented" &&
    node.body.trim() === "" &&
    commentCount === 0
  ) {
    return null;
  }
  return {
    id: node.fullDatabaseId ?? node.id,
    author: node.author ?? null,
    verdict,
    body: node.body,
    bodyHTML: node.bodyHTML,
    submittedAt: node.submittedAt,
    githubUrl: node.url,
    commentCount,
  };
}

export function toConversation(nodes: ConversationNodes): Conversation {
  return {
    descriptionHTML: nodes.bodyHTML ?? null,
    comments: nodes.comments.nodes
      .map(toGraphqlComment)
      .filter((comment) => comment !== null),
    reviews: nodes.reviews.nodes
      .map(toGraphqlReview)
      .filter((review) => review !== null),
    events: nodes.timelineItems.nodes
      .map(toConversationEvent)
      .filter((event) => event !== null),
  };
}

export function toRestComment(row: RawIssueComment): ConversationComment {
  return {
    id: String(row.id),
    author: row.user
      ? { login: row.user.login, avatarUrl: row.user.avatar_url }
      : null,
    body: row.body ?? "",
    bodyHTML: null,
    createdAt: row.created_at,
    githubUrl: row.html_url,
  };
}
