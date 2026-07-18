import type { Unauthorized } from "@sphynx/schema/pull-request-views";
import {
  type GitHubRateLimited,
  type GitHubUnavailable,
  PullRequestNotFound,
} from "@sphynx/schema/pull-requests";
import { Data, Schedule } from "effect";

export type GitHubAuthedError =
  | Unauthorized
  | PullRequestNotFound
  | GitHubUnavailable;

export type GitHubAuthedRestError = GitHubAuthedError | GitHubRateLimited;

export const pullRequestNotFound = () =>
  new PullRequestNotFound({ message: "Pull request not found" });

const OAUTH_RESTRICTIONS = "OAuth App access restrictions";

export const friendlyErrorMessage = (message: string) =>
  message.includes(OAUTH_RESTRICTIONS)
    ? "This organization restricts OAuth apps, so GitHub blocked the request. An organization owner can approve Sphynx in the organization's third-party access settings."
    : message;

export class RetryableGitHubError extends Data.TaggedError(
  "RetryableGitHubError"
)<{
  message: string;
}> {}

export const retryPolicy = Schedule.exponential("100 millis").pipe(
  Schedule.jittered
);
