import type { Doc } from "../_generated/dataModel";
import type { QueuePull, RepoFlow, StageGap } from "./domain";

type PullDoc = Doc<"reviewPull">;
type RepoDoc = Doc<"reviewRepo">;
type GapDoc = Doc<"stageGap">;

/**
 * Reconstruct the QueuePull contract from an embedded pull doc. Reviewer
 * counters (reviewerCount, botReviewerCount, approvals, changesRequested) derive
 * on read from the embedded reviewers — a single source of truth.
 */
export function queuePullFromDoc(doc: PullDoc): QueuePull {
  const reviewers = doc.reviewers;
  return {
    owner: doc.owner,
    repo: doc.repo,
    number: doc.number,
    title: doc.title,
    hasBody: doc.hasBody,
    author: doc.author,
    isDraft: doc.isDraft,
    state: doc.state,
    mergedAt: doc.mergedAt,
    updatedAt: new Date(doc.ghUpdatedAt).toISOString(),
    additions: doc.additions,
    deletions: doc.deletions,
    changedFiles: doc.changedFiles,
    ci: doc.ci,
    headRefName: doc.headRef,
    baseRefName: doc.baseRef,
    reviewers,
    reviewerCount: reviewers.length,
    botReviewerCount: reviewers.filter((r) => r.kind === "bot").length,
    approvals: reviewers.filter((r) => r.state === "approved").length,
    changesRequested: reviewers.filter((r) => r.state === "changes-requested")
      .length,
    unresolvedThreads: doc.unresolvedThreads,
    ciFailures: doc.ciFailures,
    ciCounts: doc.ciCounts,
    threadPreviews: doc.threadPreviews,
    decision: doc.decision,
    blocker: doc.blocker,
  };
}

export function stageGapFromDoc(gap: GapDoc): StageGap {
  return {
    from: gap.fromStage,
    to: gap.toStage,
    aheadBy: gap.aheadBy,
    pulls: gap.pulls,
    directCommits: gap.directCommits,
    promotionPull: gap.promotionPull,
  };
}

/**
 * Assemble RepoFlows from open pulls + repos + gaps, grouped by repo. Only repos
 * with at least one open pull surface in the queue; every repo carries its
 * stages and any promotion-rail gaps.
 */
export function toRepoFlows(
  pulls: readonly PullDoc[],
  repos: readonly RepoDoc[],
  gaps: readonly GapDoc[]
): RepoFlow[] {
  const repoByKey = new Map(repos.map((repo) => [repo.key, repo]));
  const gapsByRepo = new Map<string, GapDoc[]>();
  for (const gap of gaps) {
    const bucket = gapsByRepo.get(gap.repoKey) ?? [];
    bucket.push(gap);
    gapsByRepo.set(gap.repoKey, bucket);
  }
  const pullsByRepo = new Map<string, PullDoc[]>();
  for (const pull of pulls) {
    const bucket = pullsByRepo.get(pull.repoKey) ?? [];
    bucket.push(pull);
    pullsByRepo.set(pull.repoKey, bucket);
  }
  const flows: RepoFlow[] = [];
  for (const [repoKey, repoPulls] of pullsByRepo) {
    const repo = repoByKey.get(repoKey);
    if (repo === undefined) {
      continue;
    }
    flows.push({
      owner: repo.owner,
      repo: repo.repo,
      stages: repo.stages,
      openPulls: repoPulls.map(queuePullFromDoc),
      gaps: (gapsByRepo.get(repoKey) ?? []).map(stageGapFromDoc),
    });
  }
  return flows;
}
