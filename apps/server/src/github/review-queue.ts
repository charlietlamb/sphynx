import {
  HttpClient,
  HttpClientRequest,
  type HttpClientResponse,
} from "@effect/platform";
import { Unauthorized } from "@sphynx/schema/pull-request-views";
import {
  GitHubRateLimited,
  GitHubUnavailable,
  type PullRequestRef,
} from "@sphynx/schema/pull-requests";
import type {
  DiscoveredRepo,
  QueuePull,
  ReviewerVerdict,
  ThreadPreview,
} from "@sphynx/schema/review-queue";
import { Context, Effect, Layer, Schema } from "effect";
import { isRateLimited, pullPath, resetAt, retryAfter } from "./client";
import { GitHubConfig } from "./config";
import {
  friendlyErrorMessage,
  type GitHubAuthedError,
  makeGraphql,
  pullRequestNotFound,
  refAnnotations,
} from "./graphql";
import { blockerFor, decide, isBotLogin, parseScore } from "./queue-decision";

const PULL_FIELDS_FRAGMENT = `
fragment PullFields on PullRequest {
  number title isDraft updatedAt additions deletions changedFiles headRefName baseRefName
  author { __typename login avatarUrl }
  statusCheckRollup {
    state
    contexts(first: 40) {
      nodes {
        __typename
        ... on CheckRun { name conclusion }
        ... on StatusContext { context state }
      }
    }
  }
  reviews(first: 30) {
    nodes { state body submittedAt author { __typename login avatarUrl } }
  }
  reviewThreads(first: 50) {
    nodes {
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

const RawContextSchema = Schema.Struct({
  __typename: Schema.String,
  name: Schema.optional(Schema.String),
  conclusion: Schema.optional(Schema.NullOr(Schema.String)),
  context: Schema.optional(Schema.String),
  state: Schema.optional(Schema.NullOr(Schema.String)),
});

const RawThreadSchema = Schema.Struct({
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

const BatchedPullsSchema = Schema.Record({
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
const MAX_CI_FAILURES = 6;
const MAX_THREAD_PREVIEWS = 3;
const MAX_PREVIEW_BODY = 180;

export function failingChecks(contexts: readonly RawContext[]): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const context of contexts) {
    if (names.length >= MAX_CI_FAILURES) {
      break;
    }
    if (
      context.__typename === "CheckRun" &&
      context.name &&
      context.conclusion &&
      FAILED_CONCLUSIONS.has(context.conclusion) &&
      !seen.has(context.name)
    ) {
      seen.add(context.name);
      names.push(context.name);
    } else if (
      context.__typename === "StatusContext" &&
      context.context &&
      context.state &&
      FAILED_STATUS_STATES.has(context.state) &&
      !seen.has(context.context)
    ) {
      seen.add(context.context);
      names.push(context.context);
    }
  }
  return names;
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
    verdicts.push({
      name: author.login,
      kind: isBotLogin(author.login, author.__typename) ? "bot" : "human",
      avatarUrl: author.avatarUrl,
      state: verdictState(review.state),
      score: scores.get(author.login) ?? null,
      submittedAt: review.submittedAt ?? "",
    });
  }
  return verdicts.sort((a, b) => a.name.localeCompare(b.name));
}

function toQueuePull(
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
    threadPreviews: threadPreviews(pull.reviewThreads.nodes),
    decision: decide(signals),
    blocker: blockerFor(signals),
  };
}

const rejectFailedResponse = (
  response: HttpClientResponse.HttpClientResponse
): Effect.Effect<void, GitHubAuthedError | GitHubRateLimited> =>
  Effect.gen(function* () {
    if (isRateLimited(response)) {
      return yield* Effect.fail(
        new GitHubRateLimited({
          message: "GitHub rate limit exceeded",
          retryAfterSeconds: retryAfter(response),
          resetAt: resetAt(response),
        })
      );
    }
    if (response.status === 401 || response.status === 403) {
      return yield* Effect.fail(
        new Unauthorized({ message: "GitHub rejected the request" })
      );
    }
    if (response.status === 404) {
      return yield* Effect.fail(pullRequestNotFound());
    }
    if (response.status >= 400) {
      const responseBody = yield* response.json.pipe(
        Effect.orElseSucceed(() => null)
      );
      const message =
        responseBody &&
        typeof responseBody === "object" &&
        "message" in responseBody
          ? friendlyErrorMessage(String(responseBody.message))
          : `GitHub rejected the request with ${response.status}`;
      return yield* Effect.fail(new GitHubUnavailable({ message }));
    }
  });

const DISCOVER_REPOS_QUERY = `
query {
  viewer {
    repositories(
      first: 50
      orderBy: { field: PUSHED_AT, direction: DESC }
      affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
      ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
    ) {
      nodes {
        name isArchived owner { login }
        pullRequests(states: [OPEN]) { totalCount }
      }
    }
  }
}`;

const DiscoverReposSchema = Schema.Struct({
  viewer: Schema.Struct({
    repositories: Schema.Struct({
      nodes: Schema.Array(
        Schema.Struct({
          name: Schema.String,
          isArchived: Schema.Boolean,
          owner: Schema.Struct({ login: Schema.String }),
          pullRequests: Schema.Struct({ totalCount: Schema.Number }),
        })
      ),
    }),
  }),
});

const MAX_DISCOVERED_REPOS = 12;
const PULLS_CHUNK_SIZE = 3;

export function repoKey(entry: { owner: string; repo: string }) {
  return `${entry.owner}/${entry.repo}`.toLowerCase();
}

const makeGitHubReviewQueue = Effect.gen(function* () {
  const config = yield* GitHubConfig;
  const client = yield* HttpClient.HttpClient;
  const github = makeGraphql(config, client);

  const restWrite = (
    token: string,
    method: "POST" | "PUT",
    path: string,
    body: Record<string, unknown>
  ): Effect.Effect<void, GitHubAuthedError | GitHubRateLimited> =>
    Effect.gen(function* () {
      const base =
        method === "PUT"
          ? HttpClientRequest.put(`${config.apiUrl}${path}`)
          : HttpClientRequest.post(`${config.apiUrl}${path}`);
      const outgoing = base.pipe(
        HttpClientRequest.bearerToken(token),
        HttpClientRequest.setHeaders({
          accept: "application/vnd.github+json",
          "x-github-api-version": config.apiVersion,
        }),
        HttpClientRequest.bodyUnsafeJson(body)
      );
      const response = yield* client
        .execute(outgoing)
        .pipe(
          Effect.mapError(
            () => new GitHubUnavailable({ message: "GitHub is unreachable" })
          )
        );
      yield* rejectFailedResponse(response);
    }).pipe(
      Effect.timeoutFail({
        duration: config.timeout,
        onTimeout: () =>
          new GitHubUnavailable({ message: "GitHub request timed out" }),
      })
    );

  const openPullsChunk = (
    repos: readonly { owner: string; repo: string }[],
    token: string
  ): Effect.Effect<Map<string, QueuePull[]>, GitHubAuthedError> => {
    const selections = repos
      .map(
        (entry, index) =>
          `r${index}: repository(owner: ${JSON.stringify(entry.owner)}, name: ${JSON.stringify(entry.repo)}) {
    pullRequests(states: [OPEN], first: 30, orderBy: { field: UPDATED_AT, direction: DESC }) {
      nodes { ...PullFields }
    }
  }`
      )
      .join("\n");
    const document = `query {\n${selections}\n}\n${PULL_FIELDS_FRAGMENT}`;
    return github.query(token, BatchedPullsSchema, document, {}).pipe(
      Effect.map((data) => {
        const byRepo = new Map<string, QueuePull[]>();
        repos.forEach((entry, index) => {
          const node = data[`r${index}`];
          if (node) {
            byRepo.set(
              repoKey(entry),
              node.pullRequests.nodes.map((pull) =>
                toQueuePull(entry.owner, entry.repo, pull)
              )
            );
          }
        });
        return byRepo;
      })
    );
  };

  const openPullsForRepos = (
    repos: readonly { owner: string; repo: string }[],
    token: string
  ): Effect.Effect<Map<string, QueuePull[]>, GitHubAuthedError> => {
    if (repos.length === 0) {
      return Effect.succeed(new Map());
    }
    const chunks: { owner: string; repo: string }[][] = [];
    for (let index = 0; index < repos.length; index += PULLS_CHUNK_SIZE) {
      chunks.push([...repos.slice(index, index + PULLS_CHUNK_SIZE)]);
    }
    return Effect.forEach(chunks, (chunk) => openPullsChunk(chunk, token), {
      concurrency: 4,
    }).pipe(
      Effect.map((maps) => {
        const merged = new Map<string, QueuePull[]>();
        for (const map of maps) {
          for (const [key, value] of map) {
            merged.set(key, value);
          }
        }
        return merged;
      }),
      Effect.withSpan("GitHubReviewQueue.openPullsForRepos"),
      Effect.annotateLogs({ repoCount: repos.length })
    );
  };

  const discoverRepos = (
    token: string
  ): Effect.Effect<DiscoveredRepo[], GitHubAuthedError> =>
    github.query(token, DiscoverReposSchema, DISCOVER_REPOS_QUERY, {}).pipe(
      Effect.map((data) =>
        data.viewer.repositories.nodes
          .filter(
            (node) => !node.isArchived && node.pullRequests.totalCount > 0
          )
          .slice(0, MAX_DISCOVERED_REPOS)
          .map((node) => ({
            owner: node.owner.login,
            repo: node.name,
            openPulls: node.pullRequests.totalCount,
          }))
      ),
      Effect.withSpan("GitHubReviewQueue.discoverRepos")
    );

  const CreatedPullResponseSchema = Schema.Struct({ number: Schema.Number });

  const createPull = (
    owner: string,
    repo: string,
    head: string,
    base: string,
    title: string,
    token: string
  ): Effect.Effect<number, GitHubAuthedError | GitHubRateLimited> =>
    Effect.gen(function* () {
      const outgoing = HttpClientRequest.post(
        `${config.apiUrl}/repos/${owner}/${repo}/pulls`
      ).pipe(
        HttpClientRequest.bearerToken(token),
        HttpClientRequest.setHeaders({
          accept: "application/vnd.github+json",
          "x-github-api-version": config.apiVersion,
        }),
        HttpClientRequest.bodyUnsafeJson({ title, head, base })
      );
      const response = yield* client
        .execute(outgoing)
        .pipe(
          Effect.mapError(
            () => new GitHubUnavailable({ message: "GitHub is unreachable" })
          )
        );
      yield* rejectFailedResponse(response);
      const body = yield* response.json.pipe(
        Effect.mapError(
          () => new GitHubUnavailable({ message: "Invalid create response" })
        )
      );
      const created = yield* Schema.decodeUnknown(CreatedPullResponseSchema)(
        body
      ).pipe(
        Effect.mapError(
          () => new GitHubUnavailable({ message: "Invalid create response" })
        )
      );
      return created.number;
    }).pipe(
      Effect.timeoutFail({
        duration: config.timeout,
        onTimeout: () =>
          new GitHubUnavailable({ message: "GitHub request timed out" }),
      }),
      Effect.withSpan("GitHubReviewQueue.createPull"),
      Effect.annotateLogs({ owner, repo, head, base })
    );

  const mergePull = (ref: PullRequestRef, token: string) =>
    restWrite(token, "PUT", pullPath(ref, "/merge"), {
      merge_method: "squash",
    }).pipe(
      Effect.withSpan("GitHubReviewQueue.mergePull"),
      Effect.annotateLogs(refAnnotations(ref))
    );

  const blockPull = (ref: PullRequestRef, body: string, token: string) =>
    restWrite(token, "POST", pullPath(ref, "/reviews"), {
      event: "REQUEST_CHANGES",
      body,
    }).pipe(
      Effect.withSpan("GitHubReviewQueue.blockPull"),
      Effect.annotateLogs(refAnnotations(ref))
    );

  return { discoverRepos, openPullsForRepos, mergePull, blockPull, createPull };
});

export class GitHubReviewQueue extends Context.Tag(
  "@sphynx/server/GitHubReviewQueue"
)<GitHubReviewQueue, Effect.Effect.Success<typeof makeGitHubReviewQueue>>() {}

export const GitHubReviewQueueLive = Layer.effect(
  GitHubReviewQueue,
  makeGitHubReviewQueue
);
