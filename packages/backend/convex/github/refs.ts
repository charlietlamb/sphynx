export interface PullRequestRef {
  readonly number: number;
  readonly owner: string;
  readonly repo: string;
}

/** The REST path for a pull request, optionally with a sub-resource suffix. */
export const pullPath = (ref: PullRequestRef, suffix = "") =>
  `/repos/${ref.owner}/${ref.repo}/pulls/${ref.number}${suffix}`;
