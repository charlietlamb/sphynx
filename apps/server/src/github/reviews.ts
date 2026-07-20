import { HttpClient } from "@effect/platform";
import type {
  CreateReviewComment,
  PendingReview,
  ReplyPayload,
  ResolveThread,
  ReviewThread,
  SubmitReview,
} from "@sphynx/schema/pull-request-comments";
import {
  type GitHubRateLimited,
  GitHubUnavailable,
  GitHubUserSchema,
  type PullRequestRef,
} from "@sphynx/schema/pull-requests";
import { Context, Effect, Layer, Schema } from "effect";
import { GitHubConfig } from "./config";
import type { GitHubAuthedError } from "./errors";
import {
  makeGraphql,
  PageInfoSchema,
  paginateConnection,
  refAnnotations,
} from "./graphql";
import { makeRest, pullPath } from "./http";

const REVIEW_THREADS_QUERY = `
query($owner: String!, $name: String!, $number: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviewThreads(first: 50, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id isResolved isOutdated viewerCanResolve path line startLine diffSide
          comments(first: 100) {
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

const PENDING_REVIEW_QUERY = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviews(first: 20, states: [PENDING]) {
        nodes { id viewerDidAuthor comments(first: 1) { totalCount } }
      }
    }
  }
}`;

const START_REVIEW_MUTATION = `
mutation($id: ID!) {
  addPullRequestReview(input: { pullRequestId: $id }) {
    pullRequestReview { id }
  }
}`;

const ADD_THREAD_MUTATION = `
mutation($input: AddPullRequestReviewThreadInput!) {
  addPullRequestReviewThread(input: $input) { thread { id } }
}`;

const RESOLVE_MUTATION = `
mutation($id: ID!) {
  resolveReviewThread(input: { threadId: $id }) { thread { id } }
}`;

const UNRESOLVE_MUTATION = `
mutation($id: ID!) {
  unresolveReviewThread(input: { threadId: $id }) { thread { id } }
}`;

const SUBMIT_REVIEW_MUTATION = `
mutation($id: ID!, $event: PullRequestReviewEvent!, $body: String) {
  submitPullRequestReview(input: { pullRequestReviewId: $id, event: $event, body: $body }) {
    pullRequestReview { id }
  }
}`;

const DISCARD_REVIEW_MUTATION = `
mutation($id: ID!) {
  deletePullRequestReview(input: { pullRequestReviewId: $id }) {
    pullRequestReview { id }
  }
}`;

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
  comments: Schema.Struct({ nodes: Schema.Array(ThreadCommentSchema) }),
});

type ThreadNode = typeof ThreadNodeSchema.Type;

const ReviewThreadsSchema = Schema.Struct({
  reviewThreads: Schema.Struct({
    pageInfo: PageInfoSchema,
    nodes: Schema.Array(ThreadNodeSchema),
  }),
});

const PendingReviewsSchema = Schema.Struct({
  reviews: Schema.Struct({
    nodes: Schema.Array(
      Schema.Struct({
        id: Schema.String,
        viewerDidAuthor: Schema.Boolean,
        comments: Schema.Struct({ totalCount: Schema.Number }),
      })
    ),
  }),
});

const StartReviewSchema = Schema.Struct({
  addPullRequestReview: Schema.NullishOr(
    Schema.Struct({
      pullRequestReview: Schema.NullishOr(Schema.Struct({ id: Schema.String })),
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
      id: Number(comment.fullDatabaseId ?? 0),
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

const githubSide = (side: CreateReviewComment["side"]) =>
  side === "deletions" ? "LEFT" : "RIGHT";

const makeGitHubReviews = Effect.gen(function* () {
  const config = yield* GitHubConfig;
  const client = yield* HttpClient.HttpClient;
  const github = makeGraphql(config, client);

  const rest = makeRest(config, client);

  const listReviewThreads = (
    ref: PullRequestRef,
    token: string
  ): Effect.Effect<ReviewThread[], GitHubAuthedError> =>
    paginateConnection(
      (after) =>
        github
          .pullRequestQuery(
            token,
            ReviewThreadsSchema,
            REVIEW_THREADS_QUERY,
            ref,
            {
              after,
            }
          )
          .pipe(Effect.map((pullRequest) => pullRequest.reviewThreads)),
      toThread
    ).pipe(
      Effect.withSpan("GitHubReviews.listReviewThreads"),
      Effect.annotateLogs(refAnnotations(ref))
    );

  const pendingReview = (
    ref: PullRequestRef,
    token: string
  ): Effect.Effect<PendingReview, GitHubAuthedError> =>
    github
      .pullRequestQuery(token, PendingReviewsSchema, PENDING_REVIEW_QUERY, ref)
      .pipe(
        Effect.map((pullRequest) => {
          const mine = pullRequest.reviews.nodes.find(
            (node) => node.viewerDidAuthor
          );
          return {
            pendingId: mine?.id ?? null,
            commentCount: mine?.comments.totalCount ?? 0,
          };
        }),
        Effect.withSpan("GitHubReviews.pendingReview"),
        Effect.annotateLogs(refAnnotations(ref))
      );

  const ensurePendingReview = (ref: PullRequestRef, token: string) =>
    Effect.gen(function* () {
      const current = yield* pendingReview(ref, token);
      if (current.pendingId) {
        return current.pendingId;
      }
      const id = yield* github.pullRequestId(ref, token);
      const started = yield* github.query(
        token,
        StartReviewSchema,
        START_REVIEW_MUTATION,
        { id }
      );
      const reviewId = started.addPullRequestReview?.pullRequestReview?.id;
      if (!reviewId) {
        return yield* Effect.fail(
          new GitHubUnavailable({ message: "Could not start a review" })
        );
      }
      return reviewId;
    });

  const createPendingComment = (
    ref: PullRequestRef,
    payload: CreateReviewComment,
    token: string
  ) =>
    Effect.gen(function* () {
      const reviewId = yield* ensurePendingReview(ref, token);
      yield* github.query(token, Schema.Unknown, ADD_THREAD_MUTATION, {
        input: {
          pullRequestReviewId: reviewId,
          path: payload.path,
          line: payload.line,
          side: githubSide(payload.side),
          body: payload.body,
          ...(payload.startLine === null
            ? {}
            : {
                startLine: payload.startLine,
                startSide: githubSide(payload.side),
              }),
        },
      });
    });

  const createImmediateComment = (
    ref: PullRequestRef,
    payload: CreateReviewComment,
    token: string
  ) =>
    rest(token, "POST", pullPath(ref, "/comments"), {
      body: payload.body,
      commit_id: payload.commitSha,
      path: payload.path,
      line: payload.line,
      side: githubSide(payload.side),
      ...(payload.startLine === null
        ? {}
        : {
            start_line: payload.startLine,
            start_side: githubSide(payload.side),
          }),
    }).pipe(Effect.asVoid);

  const createComment = (
    ref: PullRequestRef,
    payload: CreateReviewComment,
    token: string
  ): Effect.Effect<void, GitHubAuthedError | GitHubRateLimited> =>
    (payload.pending
      ? createPendingComment(ref, payload, token)
      : createImmediateComment(ref, payload, token)
    ).pipe(
      Effect.withSpan("GitHubReviews.createComment"),
      Effect.annotateLogs({
        ...refAnnotations(ref),
        "github.pending": payload.pending,
      })
    );

  const replyToComment = (
    ref: PullRequestRef,
    payload: ReplyPayload,
    token: string
  ): Effect.Effect<void, GitHubAuthedError | GitHubRateLimited> =>
    rest(
      token,
      "POST",
      pullPath(ref, `/comments/${payload.commentId}/replies`),
      {
        body: payload.body,
      }
    ).pipe(
      Effect.asVoid,
      Effect.withSpan("GitHubReviews.replyToComment"),
      Effect.annotateLogs({
        ...refAnnotations(ref),
        "github.comment_id": payload.commentId,
      })
    );

  const resolveThread = (
    payload: ResolveThread,
    token: string
  ): Effect.Effect<void, GitHubAuthedError> =>
    github
      .query(
        token,
        Schema.Unknown,
        payload.resolved ? RESOLVE_MUTATION : UNRESOLVE_MUTATION,
        { id: payload.threadId }
      )
      .pipe(
        Effect.asVoid,
        Effect.withSpan("GitHubReviews.resolveThread"),
        Effect.annotateLogs({
          "github.thread_id": payload.threadId,
          "github.resolved": payload.resolved,
        })
      );

  const submitReview = (
    ref: PullRequestRef,
    payload: SubmitReview,
    token: string
  ): Effect.Effect<void, GitHubAuthedError> =>
    Effect.gen(function* () {
      const reviewId = yield* ensurePendingReview(ref, token);
      yield* github.query(token, Schema.Unknown, SUBMIT_REVIEW_MUTATION, {
        id: reviewId,
        event: payload.event,
        body: payload.body,
      });
    }).pipe(
      Effect.withSpan("GitHubReviews.submitReview"),
      Effect.annotateLogs({
        ...refAnnotations(ref),
        "github.event": payload.event,
      })
    );

  const discardReview = (
    ref: PullRequestRef,
    token: string
  ): Effect.Effect<void, GitHubAuthedError> =>
    Effect.gen(function* () {
      const current = yield* pendingReview(ref, token);
      if (!current.pendingId) {
        return;
      }
      yield* github.query(token, Schema.Unknown, DISCARD_REVIEW_MUTATION, {
        id: current.pendingId,
      });
    }).pipe(
      Effect.withSpan("GitHubReviews.discardReview"),
      Effect.annotateLogs(refAnnotations(ref))
    );

  return {
    listReviewThreads,
    pendingReview,
    createComment,
    replyToComment,
    resolveThread,
    submitReview,
    discardReview,
  } as const;
});

export class GitHubReviews extends Context.Tag("@sphynx/server/GitHubReviews")<
  GitHubReviews,
  Effect.Effect.Success<typeof makeGitHubReviews>
>() {}

export const GitHubReviewsLive = Layer.effect(GitHubReviews, makeGitHubReviews);
