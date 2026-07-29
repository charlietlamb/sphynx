export interface PullRequestRef {
  readonly owner: string;
  readonly repo: string;
  readonly number: number;
}

/** The REST path for a pull request, optionally with a sub-resource suffix. */
export const pullPath = (ref: PullRequestRef, suffix = "") =>
  `/repos/${ref.owner}/${ref.repo}/pulls/${ref.number}${suffix}`;
