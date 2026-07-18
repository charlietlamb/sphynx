import type { CiState, Decision } from "@sphynx/schema/review-queue";

const KNOWN_BOTS = new Set([
  "claude",
  "coderabbitai",
  "copilot",
  "copilot-pull-request-reviewer",
  "cursor",
  "devin-ai-integration",
  "ellipsis-dev",
  "github-actions",
  "greptile-apps",
  "qodo-merge-pro",
  "sourcery-ai",
]);

const BOT_SUFFIX = /\[bot\]$/;

export function isBotLogin(login: string, typename?: string) {
  return (
    typename === "Bot" ||
    login.endsWith("[bot]") ||
    KNOWN_BOTS.has(login.replace(BOT_SUFFIX, "").toLowerCase())
  );
}

const HIGH_RISK_ADDITIONS = 800;
const HIGH_RISK_FILES = 30;

export interface PullSignals {
  additions: number;
  approvals: number;
  changedFiles: number;
  changesRequested: number;
  ci: CiState;
  isDraft: boolean;
  reviewerCount: number;
  unresolvedThreads: number;
}

function isHighRisk(signals: PullSignals) {
  return (
    signals.additions > HIGH_RISK_ADDITIONS ||
    signals.changedFiles > HIGH_RISK_FILES
  );
}

export function decide(signals: PullSignals): Decision {
  if (signals.isDraft) {
    return "draft";
  }
  if (signals.changesRequested > 0 || signals.ci === "failure") {
    return "contested";
  }
  if (
    signals.approvals === 0 ||
    signals.unresolvedThreads > 0 ||
    (isHighRisk(signals) && signals.reviewerCount < 2)
  ) {
    return "needs-eyes";
  }
  return "ready";
}

export function blockerFor(signals: PullSignals): string | null {
  if (signals.ci === "failure") {
    return "CI failing";
  }
  if (signals.changesRequested > 0) {
    return signals.changesRequested === 1
      ? "changes requested"
      : `changes requested ×${signals.changesRequested}`;
  }
  if (signals.reviewerCount === 0) {
    return "no reviews yet";
  }
  if (signals.approvals === 0) {
    return "no approvals yet";
  }
  if (signals.unresolvedThreads > 0) {
    return signals.unresolvedThreads === 1
      ? "1 unresolved thread"
      : `${signals.unresolvedThreads} unresolved threads`;
  }
  if (isHighRisk(signals) && signals.reviewerCount < 2) {
    return "high risk, one reviewer";
  }
  return null;
}

const SCORE_PATTERNS = [
  /<!--\s*cubic:review-summary:confidence-score:(\d{1,3}(?:\.\d)?)\/(5|10|100)\s*-->/,
  /(?:score|rating|grade)[:\s]*\*{0,2}\s*(\d{1,3}(?:\.\d)?)\s*\/\s*(5|10|100)/i,
  /\b(\d{1,3}(?:\.\d)?)\s*\/\s*(10|100)\b/,
];

export function parseScore(body: string): string | null {
  for (const pattern of SCORE_PATTERNS) {
    const match = pattern.exec(body);
    const value = match?.[1];
    const scale = match?.[2];
    if (value && scale) {
      return `${value}/${scale}`;
    }
  }
  return null;
}

const APPROVE_RATIO = 0.8;
const REJECT_RATIO = 0.4;

export function scoreVerdict(
  score: string | null
): "approved" | "changes-requested" | null {
  if (!score) {
    return null;
  }
  const [value, scale] = score.split("/").map(Number);
  if (!(value !== undefined && scale)) {
    return null;
  }
  const ratio = value / scale;
  if (ratio >= APPROVE_RATIO) {
    return "approved";
  }
  if (ratio <= REJECT_RATIO) {
    return "changes-requested";
  }
  return null;
}
