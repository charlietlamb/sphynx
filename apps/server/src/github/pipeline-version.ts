import type { PipelineVersion } from "@sphynx/schema/review-queue";
import { Context, Effect, Layer } from "effect";
import type { GitHubAuthedError } from "./errors";
import { fingerprint } from "./pipeline-fingerprint";
import { GitHubReviewQueue } from "./review-queue";

/**
 * A cheap fingerprint of "has anything changed?".
 *
 * Repo list plus each repo's open-PR count. A new, closed, or merged pull moves
 * the count; the probe costs a fraction of a full pipeline build, so the client
 * can poll it and only refetch the pipeline when this string differs.
 */
const makeGitHubPipelineVersion = Effect.gen(function* () {
  const queue = yield* GitHubReviewQueue;

  const build = (
    token: string
  ): Effect.Effect<PipelineVersion, GitHubAuthedError> =>
    queue.discoverRepos(token).pipe(
      Effect.map((repos) => ({ version: fingerprint(repos) })),
      Effect.withSpan("GitHubPipelineVersion.build")
    );

  return { build };
});

export class GitHubPipelineVersion extends Context.Tag(
  "@sphynx/server/GitHubPipelineVersion"
)<
  GitHubPipelineVersion,
  Effect.Effect.Success<typeof makeGitHubPipelineVersion>
>() {}

export const GitHubPipelineVersionLive = Layer.effect(
  GitHubPipelineVersion,
  makeGitHubPipelineVersion
);
