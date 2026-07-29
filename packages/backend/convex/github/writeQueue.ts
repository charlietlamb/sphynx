import { Effect, Schema } from "effect";
import type { QueuePull } from "./domain";
import {
  configFromEnv,
  decodeBody,
  type GitHubClient,
  makeGitHubClient,
} from "./githubClient";
import type { GitHubError } from "./githubErrors";
import {
  PULL_FIELDS_FRAGMENT,
  RawPullSchema,
  toQueuePull,
} from "./queueMappers";
import { type PullRequestRef, pullPath } from "./refs";

interface SearchResults {
  readonly pulls: QueuePull[];
  readonly totalCount: number;
}

const CreatedPullSchema = Schema.Struct({ number: Schema.Number });

const PULL_BODY_QUERY = `query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) { bodyHTML }
  }
}`;

const PullBodySchema = Schema.Struct({
  repository: Schema.NullOr(
    Schema.Struct({
      pullRequest: Schema.NullOr(
        Schema.Struct({ bodyHTML: Schema.NullishOr(Schema.String) })
      ),
    })
  ),
});

const SEARCH_PULLS_QUERY = `query($q: String!, $first: Int!) {
  search(query: $q, type: ISSUE, first: $first) {
    issueCount
    nodes {
      __typename
      ... on PullRequest {
        repository { name owner { login } }
        state
        mergedAt
        ...PullFields
      }
    }
  }
}
${PULL_FIELDS_FRAGMENT}`;

const SearchPullNodeSchema = Schema.extend(
  Schema.Struct({
    __typename: Schema.Literal("PullRequest"),
    repository: Schema.Struct({
      name: Schema.String,
      owner: Schema.Struct({ login: Schema.String }),
    }),
  }),
  RawPullSchema
);

const SearchPullsSchema = Schema.Struct({
  search: Schema.Struct({
    issueCount: Schema.Number,
    nodes: Schema.Array(Schema.Union(SearchPullNodeSchema, Schema.Struct({}))),
  }),
});

function isPullNode(node: unknown): node is typeof SearchPullNodeSchema.Type {
  return (
    typeof node === "object" &&
    node !== null &&
    (node as { __typename?: string }).__typename === "PullRequest"
  );
}

const makeWriteQueue = (client: GitHubClient) => {
  const mergePull = (
    ref: PullRequestRef,
    token: string
  ): Effect.Effect<void, GitHubError> =>
    client
      .rest(token, "PUT", pullPath(ref, "/merge"), { merge_method: "squash" })
      .pipe(
        Effect.asVoid,
        Effect.withSpan("GitHubWriteQueue.mergePull"),
        Effect.annotateLogs({ "github.repo": `${ref.owner}/${ref.repo}` })
      );

  const blockPull = (
    ref: PullRequestRef,
    body: string,
    token: string
  ): Effect.Effect<void, GitHubError> =>
    client
      .rest(token, "POST", pullPath(ref, "/reviews"), {
        event: "REQUEST_CHANGES",
        body,
      })
      .pipe(
        Effect.asVoid,
        Effect.withSpan("GitHubWriteQueue.blockPull"),
        Effect.annotateLogs({ "github.repo": `${ref.owner}/${ref.repo}` })
      );

  const createPull = (
    owner: string,
    repo: string,
    head: string,
    base: string,
    title: string,
    token: string
  ): Effect.Effect<number, GitHubError> =>
    client
      .rest(
        token,
        "POST",
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`,
        {
          title,
          head,
          base,
        }
      )
      .pipe(
        Effect.flatMap((response) =>
          decodeBody(response, CreatedPullSchema, "Invalid create response")
        ),
        Effect.map((created) => created.number),
        Effect.withSpan("GitHubWriteQueue.createPull"),
        Effect.annotateLogs({ owner, repo, head, base })
      );

  const searchPulls = (
    query: string,
    limit: number,
    token: string
  ): Effect.Effect<SearchResults, GitHubError> =>
    client
      .query(token, SearchPullsSchema, SEARCH_PULLS_QUERY, {
        q: query,
        first: limit,
      })
      .pipe(
        Effect.map((data) => ({
          totalCount: data.search.issueCount,
          pulls: data.search.nodes.flatMap((node) =>
            isPullNode(node)
              ? [
                  toQueuePull(
                    node.repository.owner.login,
                    node.repository.name,
                    node
                  ),
                ]
              : []
          ),
        })),
        Effect.withSpan("GitHubWriteQueue.searchPulls"),
        Effect.annotateLogs({ "github.search": query })
      );

  const pullBody = (
    ref: PullRequestRef,
    token: string
  ): Effect.Effect<{ body: string | null }, GitHubError> =>
    client
      .query(token, PullBodySchema, PULL_BODY_QUERY, {
        owner: ref.owner,
        repo: ref.repo,
        number: ref.number,
      })
      .pipe(
        Effect.map((data) => ({
          body: data.repository?.pullRequest?.bodyHTML?.trim() || null,
        })),
        Effect.withSpan("GitHubWriteQueue.pullBody"),
        Effect.annotateLogs({ "github.repo": `${ref.owner}/${ref.repo}` })
      );

  return { mergePull, blockPull, createPull, searchPulls, pullBody } as const;
};

export const mergePull = (
  ref: PullRequestRef,
  token: string
): Effect.Effect<void, GitHubError> =>
  makeWriteQueue(makeGitHubClient(configFromEnv())).mergePull(ref, token);

export const blockPull = (
  ref: PullRequestRef,
  body: string,
  token: string
): Effect.Effect<void, GitHubError> =>
  makeWriteQueue(makeGitHubClient(configFromEnv())).blockPull(ref, body, token);

export const createPull = (
  owner: string,
  repo: string,
  head: string,
  base: string,
  title: string,
  token: string
): Effect.Effect<number, GitHubError> =>
  makeWriteQueue(makeGitHubClient(configFromEnv())).createPull(
    owner,
    repo,
    head,
    base,
    title,
    token
  );

export const searchPulls = (
  query: string,
  limit: number,
  token: string
): Effect.Effect<SearchResults, GitHubError> =>
  makeWriteQueue(makeGitHubClient(configFromEnv())).searchPulls(
    query,
    limit,
    token
  );

export const pullBody = (
  ref: PullRequestRef,
  token: string
): Effect.Effect<{ body: string | null }, GitHubError> =>
  makeWriteQueue(makeGitHubClient(configFromEnv())).pullBody(ref, token);
