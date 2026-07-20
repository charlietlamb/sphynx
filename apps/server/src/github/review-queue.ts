import { HttpClient, HttpClientResponse } from "@effect/platform";
import {
  type GitHubRateLimited,
  GitHubUnavailable,
  type PullRequestRef,
} from "@sphynx/schema/pull-requests";
import {
  CreatedPullSchema,
  type DiscoveredRepo,
  type QueuePull,
  type SearchResults,
} from "@sphynx/schema/review-queue";
import { Array as Arr, Context, Effect, Layer, Schema } from "effect";
import { GitHubConfig } from "./config";
import type { GitHubAuthedError } from "./errors";
import { makeGraphql, refAnnotations } from "./graphql";
import { makeRest, pullPath } from "./http";
import {
  BatchedPullsSchema,
  PULL_FIELDS_FRAGMENT,
  RawPullSchema,
  toQueuePull,
} from "./queue-mappers";

const OpenPullCountsSchema = Schema.Record({
  key: Schema.String,
  value: Schema.NullOr(
    Schema.Struct({
      pullRequests: Schema.Struct({ totalCount: Schema.Number }),
    })
  ),
});

/**
 * Installation tokens authenticate as the app on an org, so there is no
 * `viewer` to hang repositories off. REST lists what the installation can see.
 */
const InstallationReposSchema = Schema.Struct({
  repositories: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      archived: Schema.Boolean,
      owner: Schema.Struct({ login: Schema.String }),
      pushed_at: Schema.NullishOr(Schema.String),
    })
  ),
});

const MAX_DISCOVERED_REPOS = 12;
/** Repos probed for open-PR counts before trimming to the discovery cap. */
const MAX_COUNTED_REPOS = 40;
const PULLS_CHUNK_SIZE = 3;

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

export function repoKey(entry: { owner: string; repo: string }) {
  return `${entry.owner}/${entry.repo}`.toLowerCase();
}

const makeGitHubReviewQueue = Effect.gen(function* () {
  const config = yield* GitHubConfig;
  const client = yield* HttpClient.HttpClient;
  const github = makeGraphql(config, client);

  const rest = makeRest(config, client);

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
    const chunks = Arr.chunksOf(repos, PULLS_CHUNK_SIZE).map((chunk) => [
      ...chunk,
    ]);
    return Effect.forEach(chunks, (chunk) => openPullsChunk(chunk, token), {
      concurrency: 4,
    }).pipe(
      Effect.map((maps) => new Map(maps.flatMap((entries) => [...entries]))),
      Effect.withSpan("GitHubReviewQueue.openPullsForRepos"),
      Effect.annotateLogs({ repoCount: repos.length })
    );
  };

  /**
   * REST only exposes `open_issues_count`, which counts issues as well as
   * pulls. One batched GraphQL call gets the real open-PR count so repos with
   * issues but no pulls don't reach the queue.
   */
  const openPullCounts = (
    repos: readonly { owner: string; repo: string }[],
    token: string
  ): Effect.Effect<DiscoveredRepo[], GitHubAuthedError> => {
    if (repos.length === 0) {
      return Effect.succeed([]);
    }
    const candidates = repos.slice(0, MAX_COUNTED_REPOS);
    const selections = candidates
      .map(
        (entry, index) =>
          `r${index}: repository(owner: ${JSON.stringify(entry.owner)}, name: ${JSON.stringify(entry.repo)}) {
    pullRequests(states: [OPEN]) { totalCount }
  }`
      )
      .join("\n");
    return github
      .query(token, OpenPullCountsSchema, `query {\n${selections}\n}`, {})
      .pipe(
        Effect.map((data) =>
          candidates
            .map((entry, index) => ({
              ...entry,
              openPulls: data[`r${index}`]?.pullRequests.totalCount ?? 0,
            }))
            .filter((entry) => entry.openPulls > 0)
            .slice(0, MAX_DISCOVERED_REPOS)
        )
      );
  };

  const discoverRepos = (
    token: string
  ): Effect.Effect<DiscoveredRepo[], GitHubAuthedError> =>
    rest(token, "GET", "/installation/repositories?per_page=100").pipe(
      Effect.flatMap((response) =>
        HttpClientResponse.schemaBodyJson(InstallationReposSchema)(
          response
        ).pipe(
          Effect.mapError(
            () =>
              new GitHubUnavailable({
                message: "Invalid installation repositories response",
              })
          )
        )
      ),
      Effect.map((page) =>
        page.repositories
          .filter((repo) => !repo.archived)
          .sort((a, b) => (b.pushed_at ?? "").localeCompare(a.pushed_at ?? ""))
          .map((repo) => ({ owner: repo.owner.login, repo: repo.name }))
      ),
      Effect.flatMap((repos) => openPullCounts(repos, token)),
      Effect.withSpan("GitHubReviewQueue.discoverRepos")
    );

  const createPull = (
    owner: string,
    repo: string,
    head: string,
    base: string,
    title: string,
    token: string
  ): Effect.Effect<number, GitHubAuthedError | GitHubRateLimited> =>
    rest(token, "POST", `/repos/${owner}/${repo}/pulls`, {
      title,
      head,
      base,
    }).pipe(
      Effect.flatMap((response) =>
        HttpClientResponse.schemaBodyJson(CreatedPullSchema)(response).pipe(
          Effect.mapError(
            () => new GitHubUnavailable({ message: "Invalid create response" })
          )
        )
      ),
      Effect.map((created) => created.number),
      Effect.withSpan("GitHubReviewQueue.createPull"),
      Effect.annotateLogs({ owner, repo, head, base })
    );

  const searchPulls = (
    query: string,
    limit: number,
    token: string
  ): Effect.Effect<SearchResults, GitHubAuthedError> =>
    github
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
        Effect.withSpan("GitHubReviewQueue.searchPulls"),
        Effect.annotateLogs({ "github.search": query })
      );

  const pullBody = (
    ref: PullRequestRef,
    token: string
  ): Effect.Effect<{ body: string | null }, GitHubAuthedError> =>
    github
      .query(token, PullBodySchema, PULL_BODY_QUERY, {
        owner: ref.owner,
        repo: ref.repo,
        number: ref.number,
      })
      .pipe(
        Effect.map((data) => ({
          body: data.repository?.pullRequest?.bodyHTML?.trim() || null,
        })),
        Effect.withSpan("GitHubReviewQueue.pullBody"),
        Effect.annotateLogs(refAnnotations(ref))
      );

  const mergePull = (ref: PullRequestRef, token: string) =>
    rest(token, "PUT", pullPath(ref, "/merge"), {
      merge_method: "squash",
    }).pipe(
      Effect.asVoid,
      Effect.withSpan("GitHubReviewQueue.mergePull"),
      Effect.annotateLogs(refAnnotations(ref))
    );

  const blockPull = (ref: PullRequestRef, body: string, token: string) =>
    rest(token, "POST", pullPath(ref, "/reviews"), {
      event: "REQUEST_CHANGES",
      body,
    }).pipe(
      Effect.asVoid,
      Effect.withSpan("GitHubReviewQueue.blockPull"),
      Effect.annotateLogs(refAnnotations(ref))
    );

  return {
    discoverRepos,
    openPullsForRepos,
    mergePull,
    blockPull,
    createPull,
    searchPulls,
    pullBody,
  };
});

export class GitHubReviewQueue extends Context.Tag(
  "@sphynx/server/GitHubReviewQueue"
)<GitHubReviewQueue, Effect.Effect.Success<typeof makeGitHubReviewQueue>>() {}

export const GitHubReviewQueueLive = Layer.effect(
  GitHubReviewQueue,
  makeGitHubReviewQueue
);
