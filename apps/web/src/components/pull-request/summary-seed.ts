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
    author: pull.author,
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
