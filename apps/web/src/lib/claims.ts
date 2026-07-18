import type { QueuePull } from "@sphynx/schema/review-queue";
import { ageDays } from "@/lib/age";

export type ClaimTone = "ready" | "blocked" | "waiting" | "neutral";

export interface Claim {
  detail: string | null;
  status: string;
  tone: ClaimTone;
}

const BOT_NAME_SUFFIX = /\[bot\]$/;
const STALE_DAYS = 3;

export function stripBotSuffix(name: string) {
  return name.replace(BOT_NAME_SUFFIX, "");
}

export function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function idleFragment(pull: QueuePull, now: number) {
  const days = Math.round(ageDays(pull.updatedAt, now));
  return days > STALE_DAYS ? `idle ${plural(days, "day")}` : null;
}

function joinFragments(fragments: (string | null)[]) {
  const present = fragments.filter((fragment): fragment is string =>
    Boolean(fragment)
  );
  return present.length > 0 ? present.join(" · ") : null;
}

function changesDetail(pull: QueuePull) {
  const blockers = pull.reviewers.filter(
    (reviewer) => reviewer.state === "changes-requested"
  );
  const first = blockers[0];
  if (blockers.length === 1 && first) {
    return `Requested by ${stripBotSuffix(first.name)}`;
  }
  return `Requested by ${plural(blockers.length, "reviewer")}`;
}

function readyDetail(pull: QueuePull, now: number) {
  const idle = idleFragment(pull, now);
  const approver = pull.reviewers.find(
    (reviewer) => reviewer.state === "approved"
  );
  const approvedBy =
    pull.approvals === 1 && approver
      ? `Approved by ${stripBotSuffix(approver.name)}`
      : `${plural(pull.approvals, "approval")}`;
  return joinFragments([approvedBy, idle ?? "checks green"]);
}

function sentenceCase(text: string) {
  return text.length > 0 ? text[0]?.toUpperCase() + text.slice(1) : text;
}

export function claimFor(pull: QueuePull, now: number): Claim {
  if (pull.isDraft) {
    return {
      status: "Draft",
      detail: "Not requesting review yet",
      tone: "neutral",
    };
  }
  if (pull.changesRequested > 0) {
    return {
      status: "Waiting on changes",
      detail: changesDetail(pull),
      tone: "blocked",
    };
  }
  if (pull.ci === "failure") {
    return {
      status: "Fix failing checks",
      detail: joinFragments([
        pull.ciFailures.length > 0 ? pull.ciFailures.join(", ") : null,
        pull.unresolvedThreads > 0
          ? plural(pull.unresolvedThreads, "open thread")
          : null,
      ]),
      tone: "blocked",
    };
  }
  if (pull.decision === "ready") {
    return {
      status: "Ready to merge",
      detail: readyDetail(pull, now),
      tone: "ready",
    };
  }
  if (pull.unresolvedThreads > 0) {
    return {
      status: "Resolve open threads",
      detail: `${pull.unresolvedThreads} unresolved`,
      tone: "waiting",
    };
  }
  if (pull.reviewers.length === 0) {
    return {
      status: "Waiting for review",
      detail: joinFragments(["No reviewers yet", idleFragment(pull, now)]),
      tone: "waiting",
    };
  }
  if (pull.ci === "pending") {
    return { status: "Waiting on checks", detail: null, tone: "waiting" };
  }
  if (pull.approvals > 0 && pull.blocker) {
    return {
      status: "Approved, but blocked",
      detail: sentenceCase(pull.blocker),
      tone: "blocked",
    };
  }
  return {
    status: "Waiting on a verdict",
    detail: `${plural(pull.reviewers.length, "review")} in, none conclusive`,
    tone: "waiting",
  };
}
