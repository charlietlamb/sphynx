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
} from "@sphynx/schema/review-queue";
import { Array as Arr, Context, Effect, Layer, Schema } from "effect";
import { GitHubConfig } from "./config";
import type { GitHubAuthedError } from "./errors";
import { makeGraphql, refAnnotations } from "./graphql";
import { makeRest, pullPath } from "./http";
import {
  BatchedPullsSchema,
  PULL_FIELDS_FRAGMENT,
  toQueuePull,
} from "./queue-mappers";

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

  return { discoverRepos, openPullsForRepos, mergePull, blockPull, createPull };
});

export class GitHubReviewQueue extends Context.Tag(
  "@sphynx/server/GitHubReviewQueue"
)<GitHubReviewQueue, Effect.Effect.Success<typeof makeGitHubReviewQueue>>() {}

export const GitHubReviewQueueLive = Layer.effect(
  GitHubReviewQueue,
  makeGitHubReviewQueue
);
