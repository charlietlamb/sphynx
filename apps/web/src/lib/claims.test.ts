import { describe, expect, test } from "bun:test";
import type { QueuePull } from "@sphynx/schema/review-queue";
import { claimFor, plural, stripBotSuffix } from "@/lib/claims";

const NOW = Date.parse("2026-07-10T00:00:00Z");

function pull(overrides: Partial<QueuePull>): QueuePull {
  return {
    owner: "acme",
    repo: "widgets",
    number: 1,
    title: "Test pull",
    author: null,
    isDraft: false,
    updatedAt: "2026-07-09T00:00:00Z",
    additions: 10,
    deletions: 5,
    changedFiles: 2,
    ci: "success",
    headRefName: "feature/a",
    baseRefName: "dev",
    reviewers: [],
    reviewerCount: 0,
    botReviewerCount: 0,
    approvals: 0,
    changesRequested: 0,
    unresolvedThreads: 0,
    ciFailures: [],
    threadPreviews: [],
    decision: "needs-eyes",
    blocker: null,
    ...overrides,
  };
}

describe("stripBotSuffix", () => {
  test("removes the [bot] suffix only", () => {
    expect(stripBotSuffix("cubic-dev-ai[bot]")).toBe("cubic-dev-ai");
    expect(stripBotSuffix("charlie")).toBe("charlie");
  });
});

describe("plural", () => {
  test("pluralizes counts", () => {
    expect(plural(1, "day")).toBe("1 day");
    expect(plural(3, "day")).toBe("3 days");
  });
});

describe("claimFor", () => {
  test("drafts are neutral", () => {
    const claim = claimFor(pull({ isDraft: true }), NOW);
    expect(claim.status).toBe("Draft");
    expect(claim.tone).toBe("neutral");
  });

  test("changes requested wins over failing ci", () => {
    const claim = claimFor(pull({ changesRequested: 1, ci: "failure" }), NOW);
    expect(claim.status).toBe("Waiting on changes");
    expect(claim.tone).toBe("blocked");
  });

  test("failing checks name the failing jobs", () => {
    const claim = claimFor(
      pull({ ci: "failure", ciFailures: ["Type Check", "Unit Tests"] }),
      NOW
    );
    expect(claim.status).toBe("Fix failing checks");
    expect(claim.detail).toBe("2 failing checks");
  });

  test("ready pulls surface the approver", () => {
    const claim = claimFor(
      pull({
        decision: "ready",
        approvals: 1,
        reviewers: [
          {
            name: "greptile[bot]",
            kind: "bot",
            avatarUrl: null,
            state: "approved",
            score: null,
            submittedAt: "2026-07-09T00:00:00Z",
          },
        ],
      }),
      NOW
    );
    expect(claim.status).toBe("Ready to merge");
    expect(claim.detail).toContain("greptile");
    expect(claim.tone).toBe("ready");
  });

  test("unreviewed pulls wait for review", () => {
    const claim = claimFor(pull({}), NOW);
    expect(claim.status).toBe("Waiting for review");
    expect(claim.tone).toBe("waiting");
  });
});
