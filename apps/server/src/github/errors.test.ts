import { describe, expect, test } from "bun:test";
import { GitHubRateLimited } from "@sphynx/schema/pull-requests";
import { Duration } from "effect";
import { rateLimitWait } from "./errors";

const NOW = new Date("2026-07-21T12:00:00Z").getTime();

const limited = (fields: {
  retryAfterSeconds?: number | null;
  resetAt?: string | null;
}) =>
  new GitHubRateLimited({
    message: "limited",
    retryAfterSeconds: fields.retryAfterSeconds ?? null,
    resetAt: fields.resetAt ?? null,
  });

describe("rateLimitWait", () => {
  test("prefers Retry-After over reset time", () => {
    const wait = rateLimitWait(
      limited({
        retryAfterSeconds: 5,
        resetAt: new Date(NOW + 3_600_000).toISOString(),
      }),
      NOW
    );
    expect(Duration.toMillis(wait)).toBe(5000);
  });

  test("falls back to reset time when no Retry-After", () => {
    const wait = rateLimitWait(
      limited({ resetAt: new Date(NOW + 8000).toISOString() }),
      NOW
    );
    expect(Duration.toMillis(wait)).toBe(8000);
  });

  test("clamps an hour-long primary reset down to the 60s ceiling", () => {
    const wait = rateLimitWait(
      limited({ resetAt: new Date(NOW + 3_600_000).toISOString() }),
      NOW
    );
    expect(Duration.toMillis(wait)).toBe(60_000);
  });

  test("floors a zero/negative wait to the 1s minimum", () => {
    expect(
      Duration.toMillis(rateLimitWait(limited({ retryAfterSeconds: 0 }), NOW))
    ).toBe(1000);
    expect(
      Duration.toMillis(
        rateLimitWait(
          limited({ resetAt: new Date(NOW - 5000).toISOString() }),
          NOW
        )
      )
    ).toBe(1000);
  });

  test("defaults to the minimum when neither signal is present", () => {
    expect(Duration.toMillis(rateLimitWait(limited({}), NOW))).toBe(1000);
  });
});
