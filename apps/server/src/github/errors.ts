import type { Unauthorized } from "@sphynx/schema/pull-request-views";
import {
  type GitHubRateLimited,
  type GitHubTimeout,
  type GitHubUnavailable,
  PullRequestNotFound,
} from "@sphynx/schema/pull-requests";
import { Data, Schedule } from "effect";

export type GitHubAuthedError =
  | Unauthorized
  | PullRequestNotFound
  | GitHubUnavailable
  | GitHubTimeout
  | GitHubRateLimited;

export type GitHubAuthedRestError = GitHubAuthedError;

export const pullRequestNotFound = () =>
  new PullRequestNotFound({ message: "Pull request not found" });

export const isRateLimited = (
  error: GitHubAuthedError
): error is GitHubRateLimited => error._tag === "GitHubRateLimited";

export class RetryableGitHubError extends Data.TaggedError(
  "RetryableGitHubError"
)<{
  message: string;
}> {}

export const retryPolicy = Schedule.exponential("100 millis").pipe(
  Schedule.jittered
);
