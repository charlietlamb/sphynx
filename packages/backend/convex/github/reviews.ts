import { Effect, Schema } from "effect";
import {
  configFromEnv,
  type GitHubClient,
  makeGitHubClient,
} from "./githubClient";
import { type GitHubError, GitHubUnavailable } from "./githubErrors";
import { type PullRequestRef, pullPath } from "./refs";

export interface CreateReviewComment {
  readonly body: string;
  readonly commitSha: string;
  readonly line: number;
  readonly path: string;
  readonly pending: boolean;
  readonly side: "additions" | "deletions";
  readonly startLine: number | null;
}

export interface ReplyPayload {
  readonly body: string;
  readonly commentId: number;
}

export interface ResolveThread {
  readonly resolved: boolean;
  readonly threadId: string;
}

export interface PendingReview {
  readonly commentCount: number;
  readonly pendingId: string | null;
}

export interface SubmitReview {
  readonly body: string | null;
  readonly event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT";
}

const PULL_REQUEST_ID_QUERY = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) { id }
  }
}`;

const PendingReviewsData = Schema.Struct({
  repository: Schema.NullishOr(
    Schema.Struct({
      pullRequest: Schema.NullishOr(
        Schema.Struct({
          reviews: Schema.Struct({
            nodes: Schema.Array(
              Schema.Struct({
                id: Schema.String,
                viewerDidAuthor: Schema.Boolean,
                comments: Schema.Struct({ totalCount: Schema.Number }),
              })
            ),
          }),
        })
      ),
    })
  ),
});

const PendingReviewData = Schema.Struct({
  repository: Schema.NullishOr(
    Schema.Struct({
      pullRequest: Schema.NullishOr(Schema.Struct({ id: Schema.String })),
    })
  ),
});

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

const StartReviewSchema = Schema.Struct({
  addPullRequestReview: Schema.NullishOr(
    Schema.Struct({
      pullRequestReview: Schema.NullishOr(Schema.Struct({ id: Schema.String })),
    })
  ),
});

const githubSide = (side: CreateReviewComment["side"]) =>
  side === "deletions" ? "LEFT" : "RIGHT";

const makeReviews = (client: GitHubClient) => {
  const pullRequestId = (
    ref: PullRequestRef,
    token: string
  ): Effect.Effect<string, GitHubError> =>
    client
      .query(token, PendingReviewData, PULL_REQUEST_ID_QUERY, {
        owner: ref.owner,
        name: ref.repo,
        number: ref.number,
      })
      .pipe(
        Effect.flatMap((data) => {
          const id = data.repository?.pullRequest?.id;
          return id
            ? Effect.succeed(id)
            : Effect.fail(
                new GitHubUnavailable({ message: "Pull request not found" })
              );
        })
      );

  const pendingReview = (
    ref: PullRequestRef,
    token: string
  ): Effect.Effect<PendingReview, GitHubError> =>
    client
      .query(token, PendingReviewsData, PENDING_REVIEW_QUERY, {
        owner: ref.owner,
        name: ref.repo,
        number: ref.number,
      })
      .pipe(
        Effect.flatMap((data) => {
          const pullRequest = data.repository?.pullRequest;
          return pullRequest
            ? Effect.succeed(pullRequest)
            : Effect.fail(
                new GitHubUnavailable({ message: "Pull request not found" })
              );
        }),
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
        Effect.annotateLogs({ "github.repo": `${ref.owner}/${ref.repo}` })
      );

  const ensurePendingReview = (
    ref: PullRequestRef,
    token: string
  ): Effect.Effect<string, GitHubError> =>
    Effect.gen(function* () {
      const current = yield* pendingReview(ref, token);
      if (current.pendingId) {
        return current.pendingId;
      }
      const id = yield* pullRequestId(ref, token);
      const started = yield* client.query(
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
  ): Effect.Effect<void, GitHubError> =>
    Effect.gen(function* () {
      const reviewId = yield* ensurePendingReview(ref, token);
      yield* client.query(token, Schema.Unknown, ADD_THREAD_MUTATION, {
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
  ): Effect.Effect<void, GitHubError> =>
    client
      .rest(token, "POST", pullPath(ref, "/comments"), {
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
      })
      .pipe(Effect.asVoid);

  const createComment = (
    ref: PullRequestRef,
    payload: CreateReviewComment,
    token: string
  ): Effect.Effect<void, GitHubError> =>
    (payload.pending
      ? createPendingComment(ref, payload, token)
      : createImmediateComment(ref, payload, token)
    ).pipe(
      Effect.withSpan("GitHubReviews.createComment"),
      Effect.annotateLogs({
        "github.repo": `${ref.owner}/${ref.repo}`,
        "github.pending": payload.pending,
      })
    );

  const replyToComment = (
    ref: PullRequestRef,
    payload: ReplyPayload,
    token: string
  ): Effect.Effect<void, GitHubError> =>
    client
      .rest(
        token,
        "POST",
        pullPath(ref, `/comments/${payload.commentId}/replies`),
        { body: payload.body }
      )
      .pipe(
        Effect.asVoid,
        Effect.withSpan("GitHubReviews.replyToComment"),
        Effect.annotateLogs({
          "github.repo": `${ref.owner}/${ref.repo}`,
          "github.comment_id": payload.commentId,
        })
      );

  const resolveThread = (
    payload: ResolveThread,
    token: string
  ): Effect.Effect<void, GitHubError> =>
    client
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
  ): Effect.Effect<void, GitHubError> =>
    Effect.gen(function* () {
      const reviewId = yield* ensurePendingReview(ref, token);
      yield* client.query(token, Schema.Unknown, SUBMIT_REVIEW_MUTATION, {
        id: reviewId,
        event: payload.event,
        body: payload.body,
      });
    }).pipe(
      Effect.withSpan("GitHubReviews.submitReview"),
      Effect.annotateLogs({
        "github.repo": `${ref.owner}/${ref.repo}`,
        "github.event": payload.event,
      })
    );

  const discardReview = (
    ref: PullRequestRef,
    token: string
  ): Effect.Effect<void, GitHubError> =>
    Effect.gen(function* () {
      const current = yield* pendingReview(ref, token);
      if (!current.pendingId) {
        return;
      }
      yield* client.query(token, Schema.Unknown, DISCARD_REVIEW_MUTATION, {
        id: current.pendingId,
      });
    }).pipe(
      Effect.withSpan("GitHubReviews.discardReview"),
      Effect.annotateLogs({ "github.repo": `${ref.owner}/${ref.repo}` })
    );

  return {
    pendingReview,
    createComment,
    replyToComment,
    resolveThread,
    submitReview,
    discardReview,
  } as const;
};

export const pendingReview = (
  ref: PullRequestRef,
  token: string
): Effect.Effect<PendingReview, GitHubError> =>
  makeReviews(makeGitHubClient(configFromEnv())).pendingReview(ref, token);

export const createComment = (
  ref: PullRequestRef,
  payload: CreateReviewComment,
  token: string
): Effect.Effect<void, GitHubError> =>
  makeReviews(makeGitHubClient(configFromEnv())).createComment(
    ref,
    payload,
    token
  );

export const replyToComment = (
  ref: PullRequestRef,
  payload: ReplyPayload,
  token: string
): Effect.Effect<void, GitHubError> =>
  makeReviews(makeGitHubClient(configFromEnv())).replyToComment(
    ref,
    payload,
    token
  );

export const resolveThread = (
  payload: ResolveThread,
  token: string
): Effect.Effect<void, GitHubError> =>
  makeReviews(makeGitHubClient(configFromEnv())).resolveThread(payload, token);

export const submitReview = (
  ref: PullRequestRef,
  payload: SubmitReview,
  token: string
): Effect.Effect<void, GitHubError> =>
  makeReviews(makeGitHubClient(configFromEnv())).submitReview(
    ref,
    payload,
    token
  );

export const discardReview = (
  ref: PullRequestRef,
  token: string
): Effect.Effect<void, GitHubError> =>
  makeReviews(makeGitHubClient(configFromEnv())).discardReview(ref, token);
