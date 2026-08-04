import { describe, expect, test } from "bun:test";
import type { QueuePull } from "@sphynx/schema/review-queue";
import { buildStack } from "@/components/pull-request/stack";

function pull(number: number, headRef: string, baseRef: string): QueuePull {
  return {
    owner: "acme",
    repo: "widgets",
    number,
    title: `#${number}`,
    hasBody: false,
    author: null,
    isDraft: false,
    state: "open",
    mergedAt: null,
    updatedAt: "2026-08-01T00:00:00Z",
    additions: 1,
    deletions: 0,
    changedFiles: 1,
    ci: "success",
    headRefName: headRef,
    baseRefName: baseRef,
    reviewers: [],
    reviewerCount: 0,
    botReviewerCount: 0,
    approvals: 0,
    changesRequested: 0,
    unresolvedThreads: 0,
    ciFailures: [],
    ciCounts: { failed: 0, passed: 0, pending: 0 },
    threadPreviews: [],
    decision: "needs-eyes",
    blocker: null,
  };
}

const STACK = [
  pull(2562, "stack/observability", "dev"),
  pull(2563, "stack/outage-resilience", "stack/observability"),
  pull(2564, "stack/customer-lsns", "stack/outage-resilience"),
  pull(2565, "stack/replica-reads", "stack/customer-lsns"),
  pull(2578, "stack/check-fail-open", "stack/replica-reads"),
];

describe("buildStack", () => {
  test("builds the full chain from any member, base first", () => {
    const stack = buildStack(STACK, 2565);
    expect(stack?.entries.map((e) => e.number)).toEqual([
      2562, 2563, 2564, 2565, 2578,
    ]);
    expect(stack?.baseBranch).toBe("dev");
  });

  test("positions the current PR from the base", () => {
    expect(buildStack(STACK, 2565)?.position).toBe(4);
    expect(buildStack(STACK, 2562)?.position).toBe(1);
    expect(buildStack(STACK, 2578)?.position).toBe(5);
  });

  test("marks the current entry", () => {
    const stack = buildStack(STACK, 2564);
    expect(stack?.entries.find((e) => e.isCurrent)?.number).toBe(2564);
    expect(stack?.entries.filter((e) => e.isCurrent)).toHaveLength(1);
  });

  test("the tip and root resolve the same full stack", () => {
    const fromTip = buildStack(STACK, 2578)?.entries.map((e) => e.number);
    const fromRoot = buildStack(STACK, 2562)?.entries.map((e) => e.number);
    expect(fromTip).toEqual(fromRoot ?? []);
  });

  test("a lone PR landing on a branch is not a stack", () => {
    expect(buildStack([pull(1, "feature", "dev")], 1)).toBeNull();
  });

  test("ignores unrelated pulls in the same repo", () => {
    const pulls = [...STACK, pull(9, "other-feature", "dev")];
    const stack = buildStack(pulls, 2564);
    expect(stack?.entries.map((e) => e.number)).toEqual([
      2562, 2563, 2564, 2565, 2578,
    ]);
  });

  test("returns null when the PR is not in the pulls", () => {
    expect(buildStack(STACK, 9999)).toBeNull();
  });

  test("a two-PR stack is a stack", () => {
    const pulls = [
      pull(1, "base-feature", "dev"),
      pull(2, "top-feature", "base-feature"),
    ];
    expect(buildStack(pulls, 2)?.entries.map((e) => e.number)).toEqual([1, 2]);
  });
});
