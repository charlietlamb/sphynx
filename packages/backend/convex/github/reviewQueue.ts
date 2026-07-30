import { Effect, Schema } from "effect";
import type { QueuePull } from "./domain";
import { decodeBody, type GitHubClient } from "./githubClient";
import { type GitHubError, GitHubUnavailable } from "./githubErrors";
import { MAX_PIPELINE_PULLS } from "./limits";
import {
  PULL_FIELDS_FRAGMENT,
  RawPullSchema,
  toQueuePull,
} from "./queueMappers";

const SINGLE_PULL_QUERY = `query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      state
      mergedAt
      ...PullFields
    }
  }
}
${PULL_FIELDS_FRAGMENT}`;

const SinglePullSchema = Schema.Struct({
  repository: Schema.NullOr(
    Schema.Struct({ pullRequest: Schema.NullOr(RawPullSchema) })
  ),
});

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

const PULLS_CONCURRENCY = 8;

export function repoKey(entry: { owner: string; repo: string }) {
  return `${entry.owner}/${entry.repo}`.toLowerCase();
}

export const makeReviewQueue = (client: GitHubClient) => {
  let openPullCount = 0;
  const PullPageSchema = Schema.Struct({
    repository: Schema.NullOr(
      Schema.Struct({
        pullRequests: Schema.Struct({
          nodes: Schema.Array(RawPullSchema),
          pageInfo: Schema.Struct({
            hasNextPage: Schema.Boolean,
            endCursor: Schema.NullishOr(Schema.String),
          }),
        }),
      })
    ),
  });
  type PullPage = typeof PullPageSchema.Type;
  type PullConnection = NonNullable<PullPage["repository"]>["pullRequests"];

  const openPullsForRepo = (
    entry: { owner: string; repo: string },
    token: string
  ): Effect.Effect<QueuePull[], GitHubError> =>
    Effect.gen(function* () {
      const pulls: QueuePull[] = [];
      let after: string | null = null;
      let more = true;
      while (more) {
        const data: PullPage = yield* client.query(
          token,
          PullPageSchema,
          `query($owner: String!, $name: String!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequests(states: [OPEN], first: 100, after: $after, orderBy: { field: UPDATED_AT, direction: DESC }) {
      nodes { ...PullFields }
      pageInfo { hasNextPage endCursor }
    }
  }
}
${PULL_FIELDS_FRAGMENT}`,
          { owner: entry.owner, name: entry.repo, after }
        );
        const connection: PullConnection | undefined =
          data.repository?.pullRequests;
        if (!connection) {
          return yield* Effect.fail(
            new GitHubUnavailable({
              message: `Missing open pull data for ${entry.owner}/${entry.repo}`,
            })
          );
        }
        openPullCount += connection.nodes.length;
        if (openPullCount > MAX_PIPELINE_PULLS) {
          return yield* Effect.fail(
            new GitHubUnavailable({
              message: `Installation exceeds the ${MAX_PIPELINE_PULLS} open pull request materialization limit`,
            })
          );
        }
        pulls.push(
          ...connection.nodes.map((pull) =>
            toQueuePull(entry.owner, entry.repo, pull)
          )
        );
        after = connection.pageInfo.endCursor ?? null;
        more = connection.pageInfo.hasNextPage && after !== null;
      }
      return pulls;
    });

  const openPullsChunk = (
    repos: readonly { owner: string; repo: string }[],
    token: string
  ): Effect.Effect<Map<string, QueuePull[]>, GitHubError> =>
    Effect.forEach(
      repos,
      (entry) =>
        openPullsForRepo(entry, token).pipe(
          Effect.map((pulls) => [repoKey(entry), pulls] as const)
        ),
      { concurrency: PULLS_CONCURRENCY }
    ).pipe(Effect.map((entries) => new Map(entries)));

  const openPullsForRepos = (
    repos: readonly { owner: string; repo: string }[],
    token: string
  ): Effect.Effect<Map<string, QueuePull[]>, GitHubError> => {
    if (repos.length === 0) {
      return Effect.succeed(new Map<string, QueuePull[]>());
    }
    return openPullsChunk(repos, token).pipe(
      Effect.withSpan("GitHubReviewQueue.openPullsForRepos"),
      Effect.annotateLogs({ repoCount: repos.length })
    );
  };

  const reposPage = (
    token: string,
    page: number
  ): Effect.Effect<
    { repositories: readonly InstallationRepo[]; nextPage: number | null },
    GitHubError
  > =>
    client
      .rest(
        token,
        "GET",
        `/installation/repositories?per_page=100&page=${page}`
      )
      .pipe(
        Effect.flatMap((response) =>
          decodeBody(
            response,
            InstallationReposSchema,
            "Invalid installation repositories response"
          ).pipe(
            Effect.map((decoded) => ({
              repositories: decoded.repositories,
              nextPage: nextInstallationPage(response.header("link")),
            }))
          )
        )
      );

  /**
   * Repos the installation can see, most recently pushed first. Installations
   * with more than one page (>100 repos) must be walked in full: the endpoint
   * orders by repo id, not push time, so a recently-pushed repo can sit on a
   * later page and would otherwise never surface in the switcher.
   */
  const discoverRepos = (
    token: string
  ): Effect.Effect<{ owner: string; repo: string }[], GitHubError> =>
    Effect.gen(function* () {
      const repositories: InstallationRepo[] = [];
      let page = 1;
      let nextPage: number | null = 1;
      while (nextPage !== null) {
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
        .map((repo) => ({ owner: repo.owner.login, repo: repo.name }));
    }).pipe(Effect.withSpan("GitHubReviewQueue.discoverRepos"));

  /**
   * A repo's recent activity from the Events API — the one-time seed for the
   * workbench feed at backfill/resync. Steady-state feed updates come from
   * webhooks; this fills history that predates them. Returns raw entries for
   * `toWorkbenchEvents` to map.
   */
  const repoEvents = (
    entry: { owner: string; repo: string },
    token: string
  ): Effect.Effect<readonly unknown[], GitHubError> =>
    client
      .rest(
        token,
        "GET",
        `/repos/${encodeURIComponent(entry.owner)}/${encodeURIComponent(entry.repo)}/events?per_page=100`
      )
      .pipe(
        Effect.flatMap((response) =>
          decodeBody(
            response,
            Schema.Array(Schema.Unknown),
            "Invalid events response"
          )
        ),
        Effect.withSpan("GitHubReviewQueue.repoEvents"),
        Effect.annotateLogs({ "github.repo": repoKey(entry) })
      );

  /**
   * Re-derive one pull request into the queue shape — the projector's per-PR
   * refresh. Fetches just that PR through the same `toQueuePull` mapping the
   * batch build uses, so a webhook update and a full rebuild agree.
   */
  const refreshPull = (
    ref: { owner: string; repo: string; number: number },
    token: string
  ): Effect.Effect<QueuePull | null, GitHubError> =>
    client
      .query(token, SinglePullSchema, SINGLE_PULL_QUERY, {
        owner: ref.owner,
        name: ref.repo,
        number: ref.number,
      })
      .pipe(
        Effect.map((data) => {
          const pull = data.repository?.pullRequest ?? null;
          return pull === null ? null : toQueuePull(ref.owner, ref.repo, pull);
        }),
        Effect.withSpan("GitHubReviewQueue.refreshPull")
      );

  return {
    discoverRepos,
    openPullsChunk,
    openPullsForRepos,
    refreshPull,
    repoEvents,
  } as const;
};

export type ReviewQueue = ReturnType<typeof makeReviewQueue>;
