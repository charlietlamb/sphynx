import type {
  PullRequestRef,
  PullRequestSummary,
} from "@sphynx/schema/pull-requests";
import type { QueuePull } from "@sphynx/schema/review-queue";
import type { QueryClient } from "@tanstack/react-query";

interface OpenPullShape {
  readonly openPulls: readonly QueuePull[];
}

interface ReposShape {
  readonly repos: readonly OpenPullShape[];
}

const matches = (pull: QueuePull, ref: PullRequestRef) =>
  pull.owner === ref.owner &&
  pull.repo === ref.repo &&
  pull.number === ref.number;

/**
 * The `QueuePull` the dashboard already cached for this PR, if the page was
 * reached from the dashboard. Searches both the pipeline and the queue caches
 * across every installation, since the PR page does not know which installation
 * owns the repo at seed time.
 */
function cachedPull(
  queryClient: QueryClient,
  ref: PullRequestRef
): QueuePull | null {
  const caches = queryClient.getQueriesData<ReposShape>({
    predicate: (query) => {
      const key = query.queryKey;
      return (
        key[0] === "gh" &&
        key[1] === "installation" &&
        (key[3] === "pipeline" || key[3] === "queue")
      );
    },
  });
  for (const [, data] of caches) {
    for (const repo of data?.repos ?? []) {
      const found = repo.openPulls.find((pull) => matches(pull, ref));
      if (found) {
        return found;
      }
    }
  }
  return null;
}

/**
 * A partial `PullRequestSummary` synthesized from the dashboard's cached pull,
 * so the header paints its real title/state/author/refs on the first frame when
 * arriving from the dashboard, before the live summary lands.
 *
 * Fields the queue row does not carry — the head/base shas, commit and comment
 * counts, body, and the numeric repo id — are placeheld and filled the moment
 * the real fetch resolves (which is why the caller must use this as
 * `placeholderData`, never `initialData`: it must not persist in the cache).
 */
export function seededSummary(
  queryClient: QueryClient,
  ref: PullRequestRef
): PullRequestSummary | undefined {
  const pull = cachedPull(queryClient, ref);
  if (!pull) {
    return;
  }
  return {
    repository: {
      id: 0,
      owner: pull.owner,
      name: pull.repo,
      url: `https://github.com/${pull.owner}/${pull.repo}`,
    },
    number: pull.number,
    title: pull.title,
    body: null,
    state: pull.state,
    draft: pull.isDraft,
    author: pull.author
      ? { login: pull.author.login, avatarUrl: pull.author.avatarUrl ?? "" }
      : null,
    base: { ref: pull.baseRefName, sha: "" },
    head: { ref: pull.headRefName, sha: "" },
    stats: {
      commits: 0,
      changedFiles: pull.changedFiles,
      additions: pull.additions,
      deletions: pull.deletions,
      comments: 0,
      reviewComments: 0,
    },
    createdAt: pull.updatedAt,
    updatedAt: pull.updatedAt,
    mergedAt: pull.mergedAt,
    githubUrl: `https://github.com/${pull.owner}/${pull.repo}/pull/${pull.number}`,
  };
}

export interface PullSummarySeed {
  additions: number;
  author: { login: string; avatarUrl: string | null } | null;
  baseRef: string;
  changedFiles: number;
  deletions: number;
  draft: boolean;
  headRef: string;
  mergedAt: string | null;
  number: number;
  owner: string;
  repo: string;
  state: "open" | "closed" | "merged";
  title: string;
}

/**
 * A `PullRequestSummary` synthesized from the read-model seed, so the header
 * paints on the first frame of any load — direct, reload, or from the dashboard.
 * The fields the read model does not carry (body, shas, commit/comment counts,
 * created time) are placeheld and filled the moment the live summary resolves.
 */
export function summaryFromSeed(
  seed: PullSummarySeed | null | undefined
): PullRequestSummary | undefined {
  if (!seed) {
    return;
  }
  return {
    repository: {
      id: 0,
      owner: seed.owner,
      name: seed.repo,
      url: `https://github.com/${seed.owner}/${seed.repo}`,
    },
    number: seed.number,
    title: seed.title,
    body: null,
    state: seed.state,
    draft: seed.draft,
    author: seed.author
      ? { login: seed.author.login, avatarUrl: seed.author.avatarUrl ?? "" }
      : null,
    base: { ref: seed.baseRef, sha: "" },
    head: { ref: seed.headRef, sha: "" },
    stats: {
      commits: 0,
      changedFiles: seed.changedFiles,
      additions: seed.additions,
      deletions: seed.deletions,
      comments: 0,
      reviewComments: 0,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    mergedAt: seed.mergedAt,
    githubUrl: `https://github.com/${seed.owner}/${seed.repo}/pull/${seed.number}`,
  };
}
