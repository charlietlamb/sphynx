import { Array as Arr, Effect, Schema } from "effect";
import type { QueuePull } from "./domain";
import type { GitHubClient } from "./githubClient";
import { GitHubUnavailable, type GitHubError } from "./githubErrors";
import {
  BatchedPullsSchema,
  PULL_FIELDS_FRAGMENT,
  toQueuePull,
} from "./queueMappers";

/**
 * Installation tokens authenticate as the app on an org, so there is no
 * `viewer` to hang repositories off. REST lists what the installation can see.
 */
const InstallationRepoSchema = Schema.Struct({
  name: Schema.String,
  archived: Schema.Boolean,
  owner: Schema.Struct({ login: Schema.String }),
  pushed_at: Schema.NullishOr(Schema.String),
});

type InstallationRepo = typeof InstallationRepoSchema.Type;

const InstallationReposSchema = Schema.Struct({
  repositories: Schema.Array(InstallationRepoSchema),
});

const LINK_URL = /<([^>]+)>/;

const nextInstallationPage = (link: string | null) => {
  const target = link
    ?.split(",")
    .find((part) => part.includes('rel="next"'))
    ?.match(LINK_URL)?.[1];
  if (!target) {
    return null;
  }
  const page = Number(new URL(target).searchParams.get("page"));
  return Number.isInteger(page) ? page : null;
};

/** Repos probed for open-PR counts before trimming to the discovery cap. */
const MAX_COUNTED_REPOS = 40;
/** Installation-repository pages walked; 100 per page bounds huge accounts. */
const MAX_REPO_PAGES = 10;
/**
 * Open pulls fetched per repo. GitHub caps a connection page at 100, and a
 * repo above that is past what the queue can usefully show. Previously 30,
 * which silently dropped the oldest pulls on any busy repo.
 */
const OPEN_PULLS_PER_REPO = 100;

const PULLS_CHUNK_SIZE = 3;

/** Batched GraphQL chunks run wide; each is one request. */
const PULLS_CONCURRENCY = 8;

export function repoKey(entry: { owner: string; repo: string }) {
  return `${entry.owner}/${entry.repo}`.toLowerCase();
}

export const makeReviewQueue = (client: GitHubClient) => {
  const openPullsChunk = (
    repos: readonly { owner: string; repo: string }[],
    token: string,
  ): Effect.Effect<Map<string, QueuePull[]>, GitHubError> => {
    const selections = repos
      .map(
        (entry, index) =>
          `r${index}: repository(owner: ${JSON.stringify(entry.owner)}, name: ${JSON.stringify(entry.repo)}) {
    pullRequests(states: [OPEN], first: ${OPEN_PULLS_PER_REPO}, orderBy: { field: UPDATED_AT, direction: DESC }) {
      nodes { ...PullFields }
    }
  }`,
      )
      .join("\n");
    const document = `query {\n${selections}\n}\n${PULL_FIELDS_FRAGMENT}`;
    return client.query(token, BatchedPullsSchema, document, {}).pipe(
      Effect.map((data) => {
        const byRepo = new Map<string, QueuePull[]>();
        repos.forEach((entry, index) => {
          const node = data[`r${index}`];
          if (node) {
            byRepo.set(
              repoKey(entry),
              node.pullRequests.nodes.map((pull) =>
                toQueuePull(entry.owner, entry.repo, pull),
              ),
            );
          }
        });
        return byRepo;
      }),
    );
  };

  const openPullsForRepos = (
    repos: readonly { owner: string; repo: string }[],
    token: string,
  ): Effect.Effect<Map<string, QueuePull[]>, GitHubError> => {
    if (repos.length === 0) {
      return Effect.succeed(new Map());
    }
    const chunks = Arr.chunksOf(repos, PULLS_CHUNK_SIZE).map((chunk) => [
      ...chunk,
    ]);
    return Effect.forEach(chunks, (chunk) => openPullsChunk(chunk, token), {
      concurrency: PULLS_CONCURRENCY,
    }).pipe(
      Effect.map((maps) => new Map(maps.flatMap((entries) => [...entries]))),
      Effect.withSpan("GitHubReviewQueue.openPullsForRepos"),
      Effect.annotateLogs({ repoCount: repos.length }),
    );
  };

  const reposPage = (
    token: string,
    page: number,
  ): Effect.Effect<
    { repositories: readonly InstallationRepo[]; nextPage: number | null },
    GitHubError
  > =>
    client
      .rest(
        token,
        "GET",
        `/installation/repositories?per_page=100&page=${page}`,
      )
      .pipe(
        Effect.flatMap((response) =>
          Effect.tryPromise({
            try: () => response.json(),
            catch: () =>
              new GitHubUnavailable({
                message: "Invalid installation repositories response",
              }),
          }).pipe(
            Effect.flatMap((body) =>
              Schema.decodeUnknown(InstallationReposSchema)(body).pipe(
                Effect.mapError(
                  () =>
                    new GitHubUnavailable({
                      message: "Invalid installation repositories response",
                    }),
                ),
              ),
            ),
            Effect.map((decoded) => ({
              repositories: decoded.repositories,
              nextPage: nextInstallationPage(response.header("link")),
            })),
          ),
        ),
      );

  /**
   * Repos the installation can see, most recently pushed first. Installations
   * with more than one page (>100 repos) must be walked in full: the endpoint
   * orders by repo id, not push time, so a recently-pushed repo can sit on a
   * later page and would otherwise never surface in the switcher.
   */
  const discoverRepos = (
    token: string,
  ): Effect.Effect<{ owner: string; repo: string }[], GitHubError> =>
    Effect.gen(function* () {
      const repositories: InstallationRepo[] = [];
      let page = 1;
      let nextPage: number | null = 1;
      while (nextPage !== null && page <= MAX_REPO_PAGES) {
        const result: {
          repositories: readonly InstallationRepo[];
          nextPage: number | null;
        } = yield* reposPage(token, page);
        repositories.push(...result.repositories);
        nextPage = result.nextPage;
        page += 1;
      }
      return repositories
        .filter((repo) => !repo.archived)
        .sort((a, b) => (b.pushed_at ?? "").localeCompare(a.pushed_at ?? ""))
        .map((repo) => ({ owner: repo.owner.login, repo: repo.name }))
        .slice(0, MAX_COUNTED_REPOS);
    }).pipe(Effect.withSpan("GitHubReviewQueue.discoverRepos"));

  /**
   * A repo's recent activity from the Events API — the one-time seed for the
   * workbench feed at backfill/resync. Steady-state feed updates come from
   * webhooks; this fills history that predates them. Returns raw entries for
   * `toWorkbenchEvents` to map.
   */
  const repoEvents = (
    entry: { owner: string; repo: string },
    token: string,
  ): Effect.Effect<readonly unknown[], GitHubError> =>
    client
      .rest(token, "GET", `/repos/${entry.owner}/${entry.repo}/events?per_page=100`)
      .pipe(
        Effect.flatMap((response) =>
          Effect.tryPromise({
            try: () => response.json(),
            catch: () =>
              new GitHubUnavailable({ message: "Invalid events response" }),
          }).pipe(
            Effect.flatMap((body) =>
              Schema.decodeUnknown(Schema.Array(Schema.Unknown))(body).pipe(
                Effect.mapError(
                  () =>
                    new GitHubUnavailable({
                      message: "Invalid events response",
                    }),
                ),
              ),
            ),
          ),
        ),
        Effect.withSpan("GitHubReviewQueue.repoEvents"),
        Effect.annotateLogs({ "github.repo": repoKey(entry) }),
      );

  return {
    discoverRepos,
    openPullsChunk,
    openPullsForRepos,
    repoEvents,
  } as const;
};

export type ReviewQueue = ReturnType<typeof makeReviewQueue>;
