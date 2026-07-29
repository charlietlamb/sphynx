import { Effect, Option, Schema } from "effect";
import {
  configFromEnv,
  type GitHubClient,
  makeGitHubClient,
} from "./githubClient";
import { type GitHubError, GitHubUnavailable } from "./githubErrors";
import { type PullRequestRef, pullPath } from "./refs";
import { buildSymbolIndex, type SymbolIndexPayload } from "./symbolIndex";

export interface GitHubUser {
  readonly avatarUrl: string;
  readonly login: string;
}

export interface PullRequestSummary {
  readonly author: GitHubUser | null;
  readonly base: { readonly ref: string; readonly sha: string };
  readonly body: string | null;
  readonly createdAt: string;
  readonly draft: boolean;
  readonly githubUrl: string;
  readonly head: { readonly ref: string; readonly sha: string };
  readonly mergedAt: string | null;
  readonly number: number;
  readonly repository: {
    readonly id: number;
    readonly owner: string;
    readonly name: string;
    readonly url: string;
  };
  readonly state: "open" | "closed" | "merged";
  readonly stats: {
    readonly commits: number;
    readonly changedFiles: number;
    readonly additions: number;
    readonly deletions: number;
    readonly comments: number;
    readonly reviewComments: number;
  };
  readonly title: string;
  readonly updatedAt: string;
}

export interface PullRequestFile {
  readonly additions: number;
  readonly changes: number;
  readonly deletions: number;
  readonly githubUrl: string;
  readonly path: string;
  readonly previousPath: string | null;
  readonly renderability: "patch" | "binary-or-large";
  readonly sha: string;
  readonly status:
    | "added"
    | "modified"
    | "deleted"
    | "renamed"
    | "copied"
    | "unknown";
}

export interface PullRequestPatches {
  readonly files: PullRequestFile[];
  readonly patches: Record<string, string>;
  readonly symbols: SymbolIndexPayload;
}

export interface ReviewComment {
  readonly author: GitHubUser | null;
  readonly body: string;
  readonly createdAt: string;
  readonly githubUrl: string;
  readonly id: string;
  readonly pending: boolean;
}

export interface ReviewThread {
  readonly comments: ReviewComment[];
  readonly id: string | null;
  readonly isOutdated: boolean;
  readonly isResolved: boolean;
  readonly line: number;
  readonly path: string;
  readonly side: "additions" | "deletions";
  readonly startLine: number | null;
  readonly viewerCanResolve: boolean;
}

export type ConversationVerdict =
  | "approved"
  | "changes-requested"
  | "commented"
  | "dismissed";

export interface ConversationComment {
  readonly author: GitHubUser | null;
  readonly body: string;
  readonly bodyHTML: string | null;
  readonly createdAt: string;
  readonly githubUrl: string;
  readonly id: string;
}

export interface ConversationReview {
  readonly author: GitHubUser | null;
  readonly body: string;
  readonly bodyHTML: string | null;
  readonly commentCount: number;
  readonly githubUrl: string;
  readonly id: string;
  readonly isBot: boolean;
  readonly submittedAt: string;
  readonly verdict: ConversationVerdict;
}

export type ConversationEventKind =
  | "commit"
  | "force-push"
  | "labeled"
  | "unlabeled"
  | "review-requested"
  | "assigned"
  | "merged"
  | "closed"
  | "reopened"
  | "renamed";

export interface ConversationEvent {
  readonly actor: GitHubUser | null;
  readonly at: string;
  readonly detail: string | null;
  readonly id: string;
  readonly kind: ConversationEventKind;
  readonly ref: string | null;
  readonly url: string | null;
}

export interface Conversation {
  readonly comments: ConversationComment[];
  readonly descriptionHTML: string | null;
  readonly events: ConversationEvent[];
  readonly reviews: ConversationReview[];
}

const MAX_FILE_PAGES = 5;
const MAX_PATCH_BYTES = 8 * 1024 * 1024;
const MAX_THREAD_BYTES = 8 * 1024 * 1024;

const GitHubUserSchema = Schema.Struct({
  login: Schema.String,
  avatarUrl: Schema.String,
});

const RawUserSchema = Schema.Struct({
  login: Schema.String,
  avatar_url: Schema.String,
});

const RawGitRefSchema = Schema.Struct({
  ref: Schema.String,
  sha: Schema.String,
});

const RawPullRequestSchema = Schema.Struct({
  number: Schema.Number,
  title: Schema.String,
  body: Schema.NullOr(Schema.String),
  state: Schema.String,
  draft: Schema.Boolean,
  user: Schema.NullOr(RawUserSchema),
  base: Schema.Struct({
    ...RawGitRefSchema.fields,
    repo: Schema.Struct({
      id: Schema.Number,
      name: Schema.String,
      html_url: Schema.String,
      owner: Schema.Struct({ login: Schema.String }),
    }),
  }),
  head: RawGitRefSchema,
  commits: Schema.Number,
  changed_files: Schema.Number,
  additions: Schema.Number,
  deletions: Schema.Number,
  comments: Schema.Number,
  review_comments: Schema.Number,
  created_at: Schema.String,
  updated_at: Schema.String,
  merged_at: Schema.NullOr(Schema.String),
  html_url: Schema.String,
});

type RawPullRequest = typeof RawPullRequestSchema.Type;

const RawPullRequestFilesSchema = Schema.Array(
  Schema.Struct({
    sha: Schema.String,
    filename: Schema.String,
    previous_filename: Schema.optional(Schema.String),
    status: Schema.String,
    additions: Schema.Number,
    deletions: Schema.Number,
    changes: Schema.Number,
    patch: Schema.optional(Schema.String),
    blob_url: Schema.NullishOr(Schema.String),
  })
);

type FilesPage = typeof RawPullRequestFilesSchema.Type;

const RawFileContentsSchema = Schema.Union(
  Schema.Struct({ content: Schema.optional(Schema.String) }),
  Schema.Array(Schema.Unknown)
);

const fileContentOf = (
  value: typeof RawFileContentsSchema.Type
): string | null =>
  "content" in value && typeof value.content === "string"
    ? value.content
    : null;

const pullRequestState = (
  pull: RawPullRequest
): PullRequestSummary["state"] => {
  if (pull.merged_at) {
    return "merged";
  }
  return pull.state === "open" ? "open" : "closed";
};

const normalizePullRequest = (pull: RawPullRequest): PullRequestSummary => ({
  repository: {
    id: pull.base.repo.id,
    owner: pull.base.repo.owner.login,
    name: pull.base.repo.name,
    url: pull.base.repo.html_url,
  },
  number: pull.number,
  title: pull.title,
  body: pull.body,
  state: pullRequestState(pull),
  draft: pull.draft,
  author: pull.user
    ? { login: pull.user.login, avatarUrl: pull.user.avatar_url }
    : null,
  base: { ref: pull.base.ref, sha: pull.base.sha },
  head: { ref: pull.head.ref, sha: pull.head.sha },
  stats: {
    commits: pull.commits,
    changedFiles: pull.changed_files,
    additions: pull.additions,
    deletions: pull.deletions,
    comments: pull.comments,
    reviewComments: pull.review_comments,
  },
  createdAt: pull.created_at,
  updatedAt: pull.updated_at,
  mergedAt: pull.merged_at,
  githubUrl: pull.html_url,
});

const normalizeStatus = (status: string): PullRequestFile["status"] => {
  if (status === "removed") {
    return "deleted";
  }
  if (
    status === "added" ||
    status === "modified" ||
    status === "renamed" ||
    status === "copied"
  ) {
    return status;
  }
  return "unknown";
};

/**
 * `renderability` is derived from patch presence here, before the patch text
 * is dropped from the file list. Computing it later would report every file as
 * unrenderable.
 */
const toFile = (
  ref: PullRequestRef,
  file: FilesPage[number]
): PullRequestFile => ({
  path: file.filename,
  previousPath: file.previous_filename ?? null,
  sha: file.sha,
  status: normalizeStatus(file.status),
  additions: file.additions,
  deletions: file.deletions,
  changes: file.changes,
  renderability: file.patch ? "patch" : "binary-or-large",
  githubUrl:
    file.blob_url ??
    `https://github.com/${ref.owner}/${ref.repo}/pull/${ref.number}/files`,
});

const encodeFilePath = (path: string) =>
  path.split("/").map(encodeURIComponent).join("/");

const LINK_URL = /<([^>]+)>/;

const pageFrom = (link: string | null, rel: string) => {
  const target = link
    ?.split(",")
    .find((part) => part.includes(`rel="${rel}"`))
    ?.match(LINK_URL)?.[1];
  if (!target) {
    return null;
  }
  const page = Number(new URL(target).searchParams.get("page"));
  return Number.isInteger(page) ? page : null;
};

const nextPageFrom = (link: string | null) => pageFrom(link, "next");
const lastPageFrom = (link: string | null) => pageFrom(link, "last");

const CONVERSATION_QUERY = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      bodyHTML
      comments(first: 50) {
        totalCount
        nodes {
          id fullDatabaseId body bodyHTML createdAt url
          author { login avatarUrl }
        }
      }
      reviews(first: 50) {
        totalCount
        nodes {
          id fullDatabaseId state body bodyHTML submittedAt url
          author { __typename login avatarUrl }
          comments(first: 1) { totalCount }
        }
      }
      timelineItems(first: 100, itemTypes: [
        PULL_REQUEST_COMMIT, HEAD_REF_FORCE_PUSHED_EVENT, LABELED_EVENT,
        UNLABELED_EVENT, REVIEW_REQUESTED_EVENT, ASSIGNED_EVENT, MERGED_EVENT,
        CLOSED_EVENT, REOPENED_EVENT, RENAMED_TITLE_EVENT
      ]) {
        totalCount
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

const RawReviewAuthorSchema = Schema.Struct({
  __typename: Schema.optional(Schema.String),
  login: Schema.String,
  avatarUrl: Schema.String,
});

const RawConversationReviewSchema = Schema.Struct({
  id: Schema.String,
  fullDatabaseId: Schema.NullishOr(Schema.String),
  state: Schema.String,
  body: Schema.String,
  bodyHTML: Schema.String,
  submittedAt: Schema.NullishOr(Schema.String),
  url: Schema.String,
  author: Schema.NullishOr(RawReviewAuthorSchema),
  comments: Schema.Struct({ totalCount: Schema.Number }),
});

type RawConversationReview = typeof RawConversationReviewSchema.Type;

const ConversationNodesSchema = Schema.Struct({
  bodyHTML: Schema.NullishOr(Schema.String),
  comments: Schema.Struct({
    totalCount: Schema.Number,
    nodes: Schema.Array(Schema.NullishOr(RawConversationCommentSchema)),
  }),
  reviews: Schema.Struct({
    totalCount: Schema.Number,
    nodes: Schema.Array(Schema.NullishOr(RawConversationReviewSchema)),
  }),
  timelineItems: Schema.Struct({
    totalCount: Schema.Number,
    nodes: Schema.Array(Schema.Unknown),
  }),
});

type ConversationNodes = typeof ConversationNodesSchema.Type;

const ConversationDataSchema = Schema.Struct({
  repository: Schema.NullishOr(
    Schema.Struct({
      pullRequest: Schema.NullishOr(ConversationNodesSchema),
    })
  ),
});

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

function toConversationEvent(node: unknown): ConversationEvent | null {
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
    author: node.author
      ? { login: node.author.login, avatarUrl: node.author.avatarUrl }
      : null,
    isBot: node.author?.__typename === "Bot",
    verdict,
    body: node.body,
    bodyHTML: node.bodyHTML,
    submittedAt: node.submittedAt,
    githubUrl: node.url,
    commentCount,
  };
}

function toConversation(nodes: ConversationNodes): Conversation {
  return {
    descriptionHTML: nodes.bodyHTML ?? null,
    comments: nodes.comments.nodes
      .map(toGraphqlComment)
      .filter((comment): comment is ConversationComment => comment !== null),
    reviews: nodes.reviews.nodes
      .map(toGraphqlReview)
      .filter((review): review is ConversationReview => review !== null),
    events: nodes.timelineItems.nodes
      .map(toConversationEvent)
      .filter((event): event is ConversationEvent => event !== null),
  };
}

const REVIEW_THREADS_QUERY = `
query($owner: String!, $name: String!, $number: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviewThreads(first: 50, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id isResolved isOutdated viewerCanResolve path line startLine diffSide
          comments(first: 100) {
            totalCount
            nodes {
              fullDatabaseId body state createdAt url
              author { login avatarUrl }
            }
          }
        }
      }
    }
  }
}`;

const PageInfoSchema = Schema.Struct({
  hasNextPage: Schema.Boolean,
  endCursor: Schema.NullishOr(Schema.String),
});

const ThreadCommentSchema = Schema.Struct({
  fullDatabaseId: Schema.NullishOr(Schema.String),
  body: Schema.String,
  state: Schema.NullishOr(Schema.String),
  createdAt: Schema.String,
  url: Schema.String,
  author: Schema.NullishOr(GitHubUserSchema),
});

const ThreadNodeSchema = Schema.Struct({
  id: Schema.String,
  isResolved: Schema.Boolean,
  isOutdated: Schema.Boolean,
  viewerCanResolve: Schema.Boolean,
  path: Schema.String,
  line: Schema.NullishOr(Schema.Number),
  startLine: Schema.NullishOr(Schema.Number),
  diffSide: Schema.NullishOr(Schema.String),
  comments: Schema.Struct({
    totalCount: Schema.Number,
    nodes: Schema.Array(ThreadCommentSchema),
  }),
});

type ThreadNode = typeof ThreadNodeSchema.Type;

const ReviewThreadsNodesSchema = Schema.Struct({
  reviewThreads: Schema.Struct({
    pageInfo: PageInfoSchema,
    nodes: Schema.Array(ThreadNodeSchema),
  }),
});

const ReviewThreadsDataSchema = Schema.Struct({
  repository: Schema.NullishOr(
    Schema.Struct({
      pullRequest: Schema.NullishOr(ReviewThreadsNodesSchema),
    })
  ),
});

const toThread = (node: ThreadNode): ReviewThread | null => {
  if (node.line === null || node.line === undefined) {
    return null;
  }
  return {
    id: node.id,
    path: node.path,
    line: node.line,
    side: node.diffSide === "LEFT" ? "deletions" : "additions",
    startLine: node.startLine ?? null,
    isResolved: node.isResolved,
    isOutdated: node.isOutdated,
    viewerCanResolve: node.viewerCanResolve,
    comments: node.comments.nodes.map((comment) => ({
      id: comment.fullDatabaseId ?? "",
      body: comment.body,
      author: comment.author
        ? { login: comment.author.login, avatarUrl: comment.author.avatarUrl }
        : null,
      createdAt: comment.createdAt,
      githubUrl: comment.url,
      pending: comment.state === "PENDING",
    })),
  };
};

const mapThreadNodes = (nodes: readonly ThreadNode[]): ReviewThread[] =>
  nodes
    .map(toThread)
    .filter((thread): thread is ReviewThread => thread !== null);

const MAX_CONNECTION_PAGES = 20;

const makePrReads = (client: GitHubClient) => {
  const getPullSummary = (
    ref: PullRequestRef,
    token: string
  ): Effect.Effect<PullRequestSummary, GitHubError> =>
    client
      .restJson(
        token,
        pullPath(ref),
        RawPullRequestSchema,
        "Invalid GitHub response"
      )
      .pipe(
        Effect.map(normalizePullRequest),
        Effect.withSpan("GitHubPrReads.getPullSummary")
      );

  const filesPage = (
    token: string,
    ref: PullRequestRef,
    page: number
  ): Effect.Effect<{ files: FilesPage; link: string | null }, GitHubError> =>
    client
      .rest(token, "GET", pullPath(ref, `/files?per_page=100&page=${page}`))
      .pipe(
        Effect.flatMap((response) =>
          Effect.tryPromise({
            try: () => response.json(),
            catch: () =>
              new GitHubUnavailable({ message: "Invalid GitHub response" }),
          }).pipe(
            Effect.flatMap((body) =>
              Schema.decodeUnknown(RawPullRequestFilesSchema)(body).pipe(
                Effect.mapError(
                  () =>
                    new GitHubUnavailable({
                      message: "Invalid GitHub response",
                    })
                )
              )
            ),
            Effect.map((files) => ({ files, link: response.header("link") }))
          )
        )
      );

  const parallelRest = (token: string, ref: PullRequestRef, last: number) =>
    last > MAX_FILE_PAGES
      ? Effect.fail(
          new GitHubUnavailable({
            message: `Pull request exceeds the ${MAX_FILE_PAGES * 100}-file limit`,
          })
        )
      : Effect.forEach(
          Array.from({ length: last - 1 }, (_, i) => i + 2),
          (page) => filesPage(token, ref, page),
          { concurrency: 6 }
        ).pipe(Effect.map((results) => results.map((result) => result.files)));

  const serialRest = (
    token: string,
    ref: PullRequestRef,
    from: number | null
  ) =>
    Effect.gen(function* () {
      const pages: FilesPage[] = [];
      let next = from;
      while (next !== null && next <= MAX_FILE_PAGES) {
        const result = yield* filesPage(token, ref, next);
        pages.push(result.files);
        next = nextPageFrom(result.link);
      }
      if (next !== null) {
        return yield* Effect.fail(
          new GitHubUnavailable({
            message: `Pull request exceeds the ${MAX_FILE_PAGES * 100}-file limit`,
          })
        );
      }
      return pages;
    });

  const assemblePatches = (
    ref: PullRequestRef,
    pages: readonly FilesPage[]
  ) => {
    const patches = new Map<string, string>();
    const files: PullRequestFile[] = [];
    for (const page of pages) {
      for (const file of page) {
        if (file.patch) {
          patches.set(file.filename, file.patch);
        }
        files.push(toFile(ref, file));
      }
    }
    const bytes = [...patches].reduce(
      (total, [path, patch]) =>
        total + Buffer.byteLength(path) + Buffer.byteLength(patch),
      0
    );
    return { bytes, files, patches };
  };

  /**
   * Fetch every file page. Page 1 reveals the total via its `rel="last"` link,
   * so the remaining pages are fetched concurrently rather than walked one at a
   * time — a large PR that used to cost N serial round-trips now costs roughly
   * one. Falls back to a serial `rel="next"` walk when GitHub omits `rel="last"`.
   */
  const collectPatches = (token: string, ref: PullRequestRef) =>
    Effect.gen(function* () {
      const first = yield* filesPage(token, ref, 1);
      const last = lastPageFrom(first.link);
      const rest =
        last === null
          ? yield* serialRest(token, ref, nextPageFrom(first.link))
          : yield* parallelRest(token, ref, last);
      return assemblePatches(ref, [first.files, ...rest]);
    });

  const listPatches = (
    ref: PullRequestRef,
    token: string
  ): Effect.Effect<PullRequestPatches, GitHubError> =>
    collectPatches(token, ref).pipe(
      Effect.flatMap(({ bytes, files, patches }) =>
        bytes > MAX_PATCH_BYTES
          ? Effect.fail(
              new GitHubUnavailable({
                message: "Pull request patches exceed the 8 MiB response limit",
              })
            )
          : Effect.succeed({
              files,
              patches: Object.fromEntries(patches),
              symbols: buildSymbolIndex(patches),
            })
      ),
      Effect.withSpan("GitHubPrReads.listPatches")
    );

  const getFileContents = (
    ref: PullRequestRef,
    path: string,
    sha: string,
    token: string
  ): Effect.Effect<string | null, GitHubError> =>
    client
      .restJson(
        token,
        `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/contents/${encodeFilePath(path)}?ref=${encodeURIComponent(sha)}`,
        RawFileContentsSchema,
        "Invalid GitHub response"
      )
      .pipe(
        Effect.map((value) => {
          const content = fileContentOf(value);
          return content
            ? Buffer.from(content, "base64").toString("utf8")
            : null;
        }),
        Effect.catchTag("PullRequestNotFound", () => Effect.succeed(null)),
        Effect.withSpan("GitHubPrReads.getFileContents")
      );

  const getConversation = (
    ref: PullRequestRef,
    token: string
  ): Effect.Effect<Conversation, GitHubError> =>
    client
      .query(token, ConversationDataSchema, CONVERSATION_QUERY, {
        owner: ref.owner,
        name: ref.repo,
        number: ref.number,
      })
      .pipe(
        Effect.flatMap((data) => {
          const nodes = data.repository?.pullRequest ?? null;
          if (!nodes) {
            return Effect.succeed({
              descriptionHTML: null,
              comments: [],
              reviews: [],
              events: [],
            });
          }
          const complete =
            nodes.comments.totalCount <= nodes.comments.nodes.length &&
            nodes.reviews.totalCount <= nodes.reviews.nodes.length &&
            nodes.timelineItems.totalCount <= nodes.timelineItems.nodes.length;
          return complete
            ? Effect.succeed(toConversation(nodes))
            : Effect.fail(
                new GitHubUnavailable({
                  message:
                    "Pull request conversation exceeds the supported history limit",
                })
              );
        }),
        Effect.withSpan("GitHubPrReads.getConversation")
      );

  const getCommentThreads = (
    ref: PullRequestRef,
    token: string
  ): Effect.Effect<ReviewThread[], GitHubError> =>
    Effect.gen(function* () {
      const threads: ReviewThread[] = [];
      let bytes = 0;
      let after: string | null = null;
      for (let page = 0; page < MAX_CONNECTION_PAGES; page += 1) {
        const data: typeof ReviewThreadsDataSchema.Type = yield* client.query(
          token,
          ReviewThreadsDataSchema,
          REVIEW_THREADS_QUERY,
          {
            owner: ref.owner,
            name: ref.repo,
            number: ref.number,
            after,
          }
        );
        const connection = data.repository?.pullRequest?.reviewThreads ?? null;
        if (connection === null) {
          return threads;
        }
        if (
          connection.nodes.some(
            (thread) =>
              thread.comments.totalCount > thread.comments.nodes.length
          )
        ) {
          return yield* Effect.fail(
            new GitHubUnavailable({
              message: "A review thread exceeds the 100-comment limit",
            })
          );
        }
        const mapped = mapThreadNodes(connection.nodes);
        bytes = yield* Effect.succeed(
          bytes + new TextEncoder().encode(JSON.stringify(mapped)).byteLength
        ).pipe(
          Effect.filterOrFail(
            (size) => size <= MAX_THREAD_BYTES,
            () =>
              new GitHubUnavailable({
                message: "Review threads exceed the 8 MiB response limit",
              })
          )
        );
        threads.push(...mapped);
        if (
          !(connection.pageInfo.hasNextPage && connection.pageInfo.endCursor)
        ) {
          return threads;
        }
        after = connection.pageInfo.endCursor;
      }
      return yield* Effect.fail(
        new GitHubUnavailable({
          message: `Pull request exceeds the ${MAX_CONNECTION_PAGES * 100}-thread limit`,
        })
      );
    }).pipe(Effect.withSpan("GitHubPrReads.getCommentThreads"));

  return {
    getPullSummary,
    listPatches,
    getFileContents,
    getConversation,
    getCommentThreads,
  } as const;
};

export const getPullSummary = (
  ref: PullRequestRef,
  token: string
): Effect.Effect<PullRequestSummary, GitHubError> => {
  const client = makeGitHubClient(configFromEnv());
  return makePrReads(client).getPullSummary(ref, token);
};

export const listPatches = (
  ref: PullRequestRef,
  token: string
): Effect.Effect<PullRequestPatches, GitHubError> => {
  const client = makeGitHubClient(configFromEnv());
  return makePrReads(client).listPatches(ref, token);
};

export const getFileContents = (
  ref: PullRequestRef,
  path: string,
  sha: string,
  token: string
): Effect.Effect<string | null, GitHubError> => {
  const client = makeGitHubClient(configFromEnv());
  return makePrReads(client).getFileContents(ref, path, sha, token);
};

export const getConversation = (
  ref: PullRequestRef,
  token: string
): Effect.Effect<Conversation, GitHubError> => {
  const client = makeGitHubClient(configFromEnv());
  return makePrReads(client).getConversation(ref, token);
};

export const getCommentThreads = (
  ref: PullRequestRef,
  token: string
): Effect.Effect<ReviewThread[], GitHubError> => {
  const client = makeGitHubClient(configFromEnv());
  return makePrReads(client).getCommentThreads(ref, token);
};
