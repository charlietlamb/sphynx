interface RepoCount {
  readonly openPulls: number;
  readonly owner: string;
  readonly repo: string;
}

/**
 * A cheap "has anything changed?" string: the repo list plus each repo's
 * open-pull count. The version probe and the pipeline cache both derive it so a
 * cached build can be compared against a freshly observed fingerprint.
 */
export const fingerprint = (repos: readonly RepoCount[]) =>
  repos.map((repo) => `${repo.owner}/${repo.repo}:${repo.openPulls}`).join("|");
