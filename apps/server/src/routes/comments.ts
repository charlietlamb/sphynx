import { HttpApiBuilder } from "@effect/platform";
import { Auth } from "@sphynx/auth";
import { Database } from "@sphynx/db/client";
import { SphynxApi } from "@sphynx/schema/api";
import { Effect } from "effect";
import { githubTokenFor } from "../auth/github-token";
import { GitHubClient } from "../github/client";
import { GitHubReviews } from "../github/reviews";

const OK = { ok: true };

export const PullRequestCommentsApiLive = HttpApiBuilder.group(
  SphynxApi,
  "pullRequestComments",
  (handlers) =>
    Effect.gen(function* () {
      const github = yield* GitHubClient;
      const reviews = yield* GitHubReviews;
      const auth = yield* Auth;
      const db = yield* Database;
      const githubToken = githubTokenFor(auth, db, "Sign in to comment");

      return handlers
        .handle("listCommentThreads", ({ path, headers }) =>
          githubToken(headers.cookie).pipe(
            Effect.flatMap((token) => reviews.listReviewThreads(path, token)),
            Effect.orElse(() => github.listReviewThreads(path)),
            Effect.map((threads) => ({ threads }))
          )
        )
        .handle("createReviewComment", ({ path, headers, payload }) =>
          githubToken(headers.cookie).pipe(
            Effect.flatMap((token) =>
              reviews.createComment(path, payload, token)
            ),
            Effect.map(() => OK)
          )
        )
        .handle("replyToComment", ({ path, headers, payload }) =>
          githubToken(headers.cookie).pipe(
            Effect.flatMap((token) =>
              reviews.replyToComment(path, payload, token)
            ),
            Effect.map(() => OK)
          )
        )
        .handle("resolveThread", ({ headers, payload }) =>
          githubToken(headers.cookie).pipe(
            Effect.flatMap((token) => reviews.resolveThread(payload, token)),
            Effect.map(() => OK)
          )
        )
        .handle("getPendingReview", ({ path, headers }) =>
          githubToken(headers.cookie).pipe(
            Effect.flatMap((token) => reviews.pendingReview(path, token))
          )
        )
        .handle("submitReview", ({ path, headers, payload }) =>
          githubToken(headers.cookie).pipe(
            Effect.flatMap((token) =>
              reviews.submitReview(path, payload, token)
            ),
            Effect.map(() => OK)
          )
        )
        .handle("discardReview", ({ path, headers }) =>
          githubToken(headers.cookie).pipe(
            Effect.flatMap((token) => reviews.discardReview(path, token)),
            Effect.map(() => OK)
          )
        );
    })
);
