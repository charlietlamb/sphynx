import type {
  FailingCheck,
  QueuePull,
  ReviewerVerdict,
  ThreadPreview,
} from "@sphynx/schema/review-queue";
import { Schema } from "effect";
import {
  blockerFor,
  decide,
  isBotLogin,
  parseScore,
  scoreVerdict,
} from "./queue-decision";

export const PULL_FIELDS_FRAGMENT = `
fragment PullFields on PullRequest {
  number title isDraft updatedAt additions deletions changedFiles headRefName baseRefName
  author { __typename login avatarUrl }
  statusCheckRollup {
    state
    contexts(first: 40) {
      nodes {
        __typename
        ... on CheckRun { name conclusion detailsUrl }
        ... on StatusContext { context state targetUrl }
      }
    }
  }
  reviews(first: 30) {
    nodes { state body submittedAt author { __typename login avatarUrl } }
  }
  reviewThreads(first: 50) {
    nodes {
      id
      isResolved
      path
      comments(first: 1) {
        nodes { body author { __typename login avatarUrl } }
      }
    }
  }
  comments(last: 10) {
    nodes { body author { __typename login avatarUrl } }
  }
}`;

const ActorSchema = Schema.NullOr(
  Schema.Struct({
    __typename: Schema.String,
    login: Schema.String,
    avatarUrl: Schema.String,
  })
);

const RawReviewSchema = Schema.Struct({
  state: Schema.String,
  body: Schema.String,
  submittedAt: Schema.NullOr(Schema.String),
  author: ActorSchema,
});

const RawContextSchema = Schema.Union(
  Schema.Struct({
    __typename: Schema.Literal("CheckRun"),
    name: Schema.String,
    conclusion: Schema.NullOr(Schema.String),
    detailsUrl: Schema.NullishOr(Schema.String),
  }),
  Schema.Struct({
    __typename: Schema.Literal("StatusContext"),
    context: Schema.String,
    state: Schema.NullOr(Schema.String),
    targetUrl: Schema.NullishOr(Schema.String),
  })
);

const RawThreadSchema = Schema.Struct({
  id: Schema.String,
  isResolved: Schema.Boolean,
  path: Schema.NullOr(Schema.String),
  comments: Schema.Struct({
    nodes: Schema.Array(
      Schema.Struct({ body: Schema.String, author: ActorSchema })
    ),
  }),
});

const RawPullSchema = Schema.Struct({
  number: Schema.Number,
  title: Schema.String,
  isDraft: Schema.Boolean,
  updatedAt: Schema.String,
  additions: Schema.Number,
  deletions: Schema.Number,
  changedFiles: Schema.Number,
  headRefName: Schema.String,
  baseRefName: Schema.String,
  author: ActorSchema,
  statusCheckRollup: Schema.NullOr(
    Schema.Struct({
      state: Schema.String,
      contexts: Schema.Struct({ nodes: Schema.Array(RawContextSchema) }),
    })
  ),
  reviews: Schema.Struct({ nodes: Schema.Array(RawReviewSchema) }),
  reviewThreads: Schema.Struct({ nodes: Schema.Array(RawThreadSchema) }),
  comments: Schema.Struct({
    nodes: Schema.Array(
      Schema.Struct({ body: Schema.String, author: ActorSchema })
    ),
  }),
});

export const BatchedPullsSchema = Schema.Record({
  key: Schema.String,
  value: Schema.NullOr(
    Schema.Struct({
      pullRequests: Schema.Struct({ nodes: Schema.Array(RawPullSchema) }),
    })
  ),
});

type RawReview = typeof RawReviewSchema.Type;
type RawContext = typeof RawContextSchema.Type;
type RawThread = typeof RawThreadSchema.Type;

const FAILED_CONCLUSIONS = new Set(["FAILURE", "TIMED_OUT", "STARTUP_FAILURE"]);
const FAILED_STATUS_STATES = new Set(["FAILURE", "ERROR"]);
const PASSED_CONCLUSIONS = new Set(["SUCCESS", "NEUTRAL", "SKIPPED"]);
const PENDING_STATUS_STATES = new Set(["PENDING", "EXPECTED"]);

type CiBucket = "failed" | "passed" | "pending" | null;

function checkRunBucket(conclusion: string | null): CiBucket {
  if (conclusion === null) {
    return "pending";
  }
  if (FAILED_CONCLUSIONS.has(conclusion)) {
    return "failed";
  }
  return PASSED_CONCLUSIONS.has(conclusion) ? "passed" : null;
}

function statusBucket(state: string | null): CiBucket {
  if (state === null) {
    return null;
  }
  if (FAILED_STATUS_STATES.has(state)) {
    return "failed";
  }
  if (state === "SUCCESS") {
    return "passed";
  }
  return PENDING_STATUS_STATES.has(state) ? "pending" : null;
}

function ciCounts(contexts: readonly RawContext[]): QueuePull["ciCounts"] {
  const counts = { failed: 0, passed: 0, pending: 0 };
  for (const context of contexts) {
    const bucket =
      context.__typename === "CheckRun"
        ? checkRunBucket(context.conclusion)
        : statusBucket(context.state);
    if (bucket) {
      counts[bucket] += 1;
    }
  }
  return counts;
}
const MAX_CI_FAILURES = 6;
const MAX_THREAD_PREVIEWS = 50;
const MAX_PREVIEW_BODY = 400;

export function failingChecks(contexts: readonly RawContext[]): FailingCheck[] {
  const checks: FailingCheck[] = [];
  const seen = new Set<string>();
  const push = (name: string, url: string | null) => {
    if (!seen.has(name) && checks.length < MAX_CI_FAILURES) {
      seen.add(name);
      checks.push({ name, url });
    }
  };
  for (const context of contexts) {
    if (
      context.__typename === "CheckRun" &&
      context.conclusion &&
      FAILED_CONCLUSIONS.has(context.conclusion)
    ) {
      push(context.name, context.detailsUrl ?? null);
    }
    if (
      context.__typename === "StatusContext" &&
      context.state &&
      FAILED_STATUS_STATES.has(context.state)
    ) {
      push(context.context, context.targetUrl ?? null);
    }
  }
  return checks;
}

const IMG_TAG = /<img[^>]*\balt="([^"]*)"[^>]*>/g;
const HTML_TAG = /<[^>]+>/g;

function stripHtml(line: string) {
  return line
    .replace(IMG_TAG, "$1 ")
    .replace(HTML_TAG, "")
    .replace(/\s{2,}/g, " ");
}

export function previewBody(body: string): string {
  const line =
    body
      .split("\n")
      .map((candidate) =>
        stripHtml(candidate.replace(/<!--[\s\S]*?-->/g, ""))
          .replace(/[*_#>`~]/g, "")
          .trim()
      )
      .find((candidate) => candidate.length > 0) ?? "";
  return line.length > MAX_PREVIEW_BODY
    ? `${line.slice(0, MAX_PREVIEW_BODY - 1)}…`
    : line;
}

function threadPreviews(threads: readonly RawThread[]) {
  const previews: ThreadPreview[] = [];
  for (const thread of threads) {
    if (previews.length >= MAX_THREAD_PREVIEWS) {
      break;
    }
    const first = thread.comments.nodes[0];
    if (thread.isResolved || !first) {
      continue;
    }
    const body = previewBody(first.body);
    if (!body) {
      continue;
    }
    previews.push({
      author: first.author
        ? { login: first.author.login, avatarUrl: first.author.avatarUrl }
        : null,
      body,
      id: thread.id,
      path: thread.path,
    });
  }
  return previews;
}

function ciState(rollup: { state: string } | null): QueuePull["ci"] {
  switch (rollup?.state) {
    case "SUCCESS":
      return "success";
    case "FAILURE":
    case "ERROR":
      return "failure";
    case "PENDING":
    case "EXPECTED":
      return "pending";
    default:
      return "none";
  }
}

function verdictState(state: string): ReviewerVerdict["state"] {
  if (state === "APPROVED") {
    return "approved";
  }
  if (state === "CHANGES_REQUESTED") {
    return "changes-requested";
  }
  return "commented";
}

function latestReviews(reviews: readonly RawReview[]) {
  const byAuthor = new Map<string, RawReview>();
  for (const review of reviews) {
    const login = review.author?.login;
    if (!login || review.state === "PENDING" || review.state === "DISMISSED") {
      continue;
    }
    byAuthor.set(login, review);
  }
  return byAuthor;
}

interface ScoreSource {
  author: { login: string } | null;
  body: string;
}

function latestScores(
  reviews: readonly RawReview[],
  comments: readonly ScoreSource[]
) {
  const byAuthor = new Map<string, string>();
  for (const review of reviews) {
    const login = review.author?.login;
    if (!login || review.state === "PENDING" || review.state === "DISMISSED") {
      continue;
    }
    const score = parseScore(review.body);
    if (score) {
      byAuthor.set(login, score);
    }
  }
  for (const comment of comments) {
    const login = comment.author?.login;
    if (!login) {
      continue;
    }
    const score = parseScore(comment.body);
    if (score) {
      byAuthor.set(login, score);
    }
  }
  return byAuthor;
}

function toVerdicts(
  reviews: readonly RawReview[],
  comments: readonly ScoreSource[] = []
): ReviewerVerdict[] {
  const verdicts: ReviewerVerdict[] = [];
  const scores = latestScores(reviews, comments);
  for (const review of latestReviews(reviews).values()) {
    const author = review.author;
    if (!author) {
      continue;
    }
    const kind = isBotLogin(author.login, author.__typename)
      ? ("bot" as const)
      : ("human" as const);
    const score = scores.get(author.login) ?? null;
    const state = verdictState(review.state);
    const effectiveState =
      kind === "bot" && state === "commented"
        ? (scoreVerdict(score) ?? state)
        : state;
    verdicts.push({
      name: author.login,
      kind,
      avatarUrl: author.avatarUrl,
      state: effectiveState,
      score,
      submittedAt: review.submittedAt ?? "",
    });
  }
  return verdicts.sort((a, b) => a.name.localeCompare(b.name));
}

export function toQueuePull(
  owner: string,
  repo: string,
  pull: typeof RawPullSchema.Type
): QueuePull {
  const verdicts = toVerdicts(pull.reviews.nodes, pull.comments.nodes);
  const unresolvedThreads = pull.reviewThreads.nodes.filter(
    (thread) => !thread.isResolved
  ).length;
  const signals = {
    additions: pull.additions,
    approvals: verdicts.filter((verdict) => verdict.state === "approved")
      .length,
    changedFiles: pull.changedFiles,
    changesRequested: verdicts.filter(
      (verdict) => verdict.state === "changes-requested"
    ).length,
    ci: ciState(pull.statusCheckRollup),
    isDraft: pull.isDraft,
    reviewerCount: verdicts.length,
    unresolvedThreads,
  };
  return {
    owner,
    repo,
    number: pull.number,
    title: pull.title,
    author: pull.author
      ? { login: pull.author.login, avatarUrl: pull.author.avatarUrl }
      : null,
    isDraft: pull.isDraft,
    updatedAt: pull.updatedAt,
    additions: pull.additions,
    deletions: pull.deletions,
    changedFiles: pull.changedFiles,
    ci: signals.ci,
    headRefName: pull.headRefName,
    baseRefName: pull.baseRefName,
    reviewers: verdicts,
    reviewerCount: verdicts.length,
    botReviewerCount: verdicts.filter((verdict) => verdict.kind === "bot")
      .length,
    approvals: signals.approvals,
    changesRequested: signals.changesRequested,
    unresolvedThreads,
    ciFailures: failingChecks(pull.statusCheckRollup?.contexts.nodes ?? []),
    ciCounts: ciCounts(pull.statusCheckRollup?.contexts.nodes ?? []),
    threadPreviews: threadPreviews(pull.reviewThreads.nodes),
    decision: decide(signals),
    blocker: blockerFor(signals),
  };
}
