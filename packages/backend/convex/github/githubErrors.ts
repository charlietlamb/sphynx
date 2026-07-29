import { Data, Duration, Effect, Schedule } from "effect";

export class Unauthorized extends Data.TaggedError("Unauthorized")<{
  message: string;
}> {}

export class PullRequestNotFound extends Data.TaggedError(
  "PullRequestNotFound",
)<{
  message: string;
}> {}

export class GitHubUnavailable extends Data.TaggedError("GitHubUnavailable")<{
  message: string;
}> {}

export class GitHubTimeout extends Data.TaggedError("GitHubTimeout")<{
  message: string;
}> {}

export class GitHubRateLimited extends Data.TaggedError("GitHubRateLimited")<{
  message: string;
  retryAfterSeconds: number | null;
  resetAt: string | null;
}> {}

export class RetryableGitHubError extends Data.TaggedError(
  "RetryableGitHubError",
)<{
  message: string;
}> {}

export type GitHubError =
  | Unauthorized
  | PullRequestNotFound
  | GitHubUnavailable
  | GitHubTimeout
  | GitHubRateLimited;

export const pullRequestNotFound = () =>
  new PullRequestNotFound({ message: "Pull request not found" });

/**
 * Transient (5xx / network) backoff — exponential with jitter, capped at 5s a
 * step so a burst of retries never sleeps unbounded. Attempt count is bounded
 * by the caller's `times`.
 */
export const retryPolicy = Schedule.exponential("100 millis").pipe(
  Schedule.jittered,
  Schedule.either(Schedule.spaced("5 seconds")),
);

const RATE_LIMIT_MAX_WAIT = Duration.seconds(60);
const RATE_LIMIT_MIN_WAIT = Duration.seconds(1);
const RATE_LIMIT_MAX_ATTEMPTS = 3;

/**
 * How long to wait before retrying a rate-limited request. GitHub's secondary
 * limit sends `Retry-After`; the primary limit sends `x-ratelimit-reset`. Prefer
 * the explicit `Retry-After`, fall back to the reset time, and clamp to a sane
 * window so a fiber never blocks for the full (up to an hour) primary reset.
 */
export const rateLimitWait = (
  error: GitHubRateLimited,
  now: number,
): Duration.Duration => {
  const fromRetryAfter =
    error.retryAfterSeconds === null
      ? null
      : Duration.seconds(error.retryAfterSeconds);
  const fromReset = error.resetAt
    ? Duration.millis(Math.max(0, new Date(error.resetAt).getTime() - now))
    : null;
  const wanted = fromRetryAfter ?? fromReset ?? RATE_LIMIT_MIN_WAIT;
  return Duration.clamp(wanted, {
    minimum: RATE_LIMIT_MIN_WAIT,
    maximum: RATE_LIMIT_MAX_WAIT,
  });
};

/**
 * Honor GitHub's rate-limit backoff. Without this a secondary-limit 403 was
 * never retried (the transient policy only matches `RetryableGitHubError`), so a
 * whole fan-out failed the moment the limit tripped, and hammering it deepened
 * the limit. This sleeps the advertised delay and retries a bounded number of
 * times; past the cap it surfaces the rate-limit error so the caller degrades.
 */
export const honorRateLimit =
  (maxAttempts = RATE_LIMIT_MAX_ATTEMPTS) =>
  <A, E extends { readonly _tag: string }, R>(
    effect: Effect.Effect<A, E, R>,
  ): Effect.Effect<A, E, R> => {
    const loop = (attempt: number): Effect.Effect<A, E, R> =>
      effect.pipe(
        Effect.catchIf(
          (error) =>
            error instanceof GitHubRateLimited && attempt < maxAttempts,
          (error) =>
            Effect.flatMap(Effect.clock, (clock) =>
              clock.currentTimeMillis.pipe(
                Effect.map((now) =>
                  rateLimitWait(error as unknown as GitHubRateLimited, now),
                ),
                Effect.tap((wait) =>
                  Effect.logWarning("github rate limited; backing off").pipe(
                    Effect.annotateLogs({
                      "github.retry_wait_ms": Duration.toMillis(wait),
                      "github.rate_limit_attempt": attempt + 1,
                    }),
                  ),
                ),
                Effect.flatMap(Effect.sleep),
                Effect.zipRight(loop(attempt + 1)),
              ),
            ),
        ),
      );
    return loop(0);
  };
