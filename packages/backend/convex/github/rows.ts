import type { QueuePull, RepoFlow } from "./domain";

export const repoKeyOf = (installationId: number, owner: string, repo: string) =>
  `${installationId}:${owner.toLowerCase()}:${repo.toLowerCase()}`;

export const pullKeyOf = (repoKey: string, number: number) =>
  `${repoKey}:${number}`;

export const pullDocFrom = (
  installationId: number,
  repoKey: string,
  owner: string,
  repo: string,
  pull: QueuePull,
) => ({
  key: pullKeyOf(repoKey, pull.number),
  repoKey,
  installationId,
  owner,
  repo,
  number: pull.number,
  state: pull.state,
  title: pull.title,
  author: pull.author,
  isDraft: pull.isDraft,
  hasBody: pull.hasBody,
  baseRef: pull.baseRefName,
  headRef: pull.headRefName,
  additions: pull.additions,
  deletions: pull.deletions,
  changedFiles: pull.changedFiles,
  ci: pull.ci,
  ciCounts: pull.ciCounts,
  unresolvedThreads: pull.unresolvedThreads,
  decision: pull.decision,
  blocker: pull.blocker,
  mergedAt: pull.mergedAt,
  reviewers: pull.reviewers,
  ciFailures: pull.ciFailures,
  threadPreviews: pull.threadPreviews,
  threads: pull.threadPreviews.map((thread) => ({
    threadId: thread.id,
    isResolved: false,
    path: thread.path,
    rootCommentId:
      thread.rootCommentId === null ? null : BigInt(thread.rootCommentId),
    authorLogin: thread.author?.login ?? null,
    authorAvatarUrl: thread.author?.avatarUrl ?? null,
    bodyPreview: thread.body,
  })),
  ghUpdatedAt: new Date(pull.updatedAt).getTime(),
});

export const gapDocsFrom = (
  installationId: number,
  repoKey: string,
  flow: RepoFlow,
) =>
  flow.gaps.map((gap) => ({
    repoKey,
    installationId,
    fromStage: gap.from,
    toStage: gap.to,
    aheadBy: gap.aheadBy,
    directCommits: gap.directCommits,
    promotionPull: gap.promotionPull,
    pulls: gap.pulls.map((pull) => ({
      number: pull.number,
      title: pull.title,
      body: pull.body,
      author: pull.author,
      mergedAt: pull.mergedAt,
    })),
  }));
