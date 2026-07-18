import type { QueuePull } from "@sphynx/schema/review-queue";
import { ageDays } from "@/lib/age";

const BOT_NAME_SUFFIX = /\[bot\]$/;

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function changesClaim(pull: QueuePull) {
  const blockers = pull.reviewers.filter(
    (reviewer) => reviewer.state === "changes-requested"
  );
  const first = blockers[0];
  if (blockers.length === 1 && first) {
    return `${first.name.replace(BOT_NAME_SUFFIX, "")} wants changes`;
  }
  return `${blockers.length} reviewers want changes`;
}

function readyClaim(pull: QueuePull, now: number) {
  const days = ageDays(pull.updatedAt, now);
  if (days > 3) {
    return `approved ${pull.approvals}×, green, ${Math.round(days)}d old — why is this still open?`;
  }
  return "approved and green — ready to merge";
}

export function claimFor(pull: QueuePull, now: number): string {
  if (pull.isDraft) {
    return "draft — not asking for eyes yet";
  }
  if (pull.changesRequested > 0) {
    return changesClaim(pull);
  }
  if (pull.ci === "failure") {
    return pull.unresolvedThreads > 0
      ? `checks failing with ${plural(pull.unresolvedThreads, "open thread")}`
      : "checks failing";
  }
  if (pull.decision === "ready") {
    return readyClaim(pull, now);
  }
  if (pull.unresolvedThreads > 0) {
    return `${plural(pull.unresolvedThreads, "open thread")} to resolve`;
  }
  if (pull.reviewers.length === 0) {
    return "no reviews yet";
  }
  if (pull.ci === "pending") {
    return "checks still running";
  }
  if (pull.approvals > 0 && pull.blocker) {
    return pull.blocker;
  }
  return `${plural(pull.reviewers.length, "review")}, no verdict yet`;
}
