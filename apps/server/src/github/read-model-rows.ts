import type { QueuePull, RepoFlow } from "@sphynx/schema/review-queue";

export const repoRowId = (
  installationId: number,
  owner: string,
  repo: string
) => `${installationId}:${owner.toLowerCase()}:${repo.toLowerCase()}`;

export const pullRowId = (repoId: string, number: number) =>
  `${repoId}:${number}`;

interface PullRow {
  readonly additions: number;
  readonly authorAvatarUrl: string | null;
  readonly authorLogin: string | null;
  readonly baseRef: string;
  readonly blocker: string | null;
  readonly changedFiles: number;
  readonly ciFailed: number;
  readonly ciPassed: number;
  readonly ciPending: number;
  readonly ciState: string;
  readonly decision: string;
  readonly deletions: number;
  readonly ghUpdatedAt: Date;
  readonly hasBody: boolean;
  readonly headRef: string;
  readonly id: string;
  readonly installationId: number;
  readonly isDraft: boolean;
  readonly mergedAt: Date | null;
  readonly number: number;
  readonly repoId: string;
  readonly state: string;
  readonly title: string;
  readonly unresolvedThreads: number;
}

interface ReviewerRow {
  readonly avatarUrl: string | null;
  readonly kind: string;
  readonly login: string;
  readonly pullId: string;
  readonly score: string | null;
  readonly state: string;
  readonly submittedAt: Date | null;
}

interface CheckRow {
  readonly bucket: string;
  readonly detailsUrl: string | null;
  readonly name: string;
  readonly pullId: string;
}

interface ThreadRow {
  readonly authorAvatarUrl: string | null;
  readonly authorLogin: string | null;
  readonly bodyPreview: string;
  readonly isResolved: boolean;
  readonly path: string | null;
  readonly pullId: string;
  readonly rootCommentId: number | null;
  readonly threadId: string;
}

export interface PullRows {
  readonly checks: CheckRow[];
  readonly pull: PullRow;
  readonly reviewers: ReviewerRow[];
  readonly threads: ThreadRow[];
}

export interface GapRow {
  readonly aheadBy: number;
  readonly directCommits: number;
  readonly fromStage: string;
  readonly installationId: number;
  readonly promotionPull: number | null;
  readonly repoId: string;
  readonly toStage: string;
}

export interface GapPullRow {
  readonly authorAvatarUrl: string | null;
  readonly authorLogin: string | null;
  readonly body: string | null;
  readonly fromStage: string;
  readonly mergedAt: Date | null;
  readonly number: number;
  readonly repoId: string;
  readonly title: string;
  readonly toStage: string;
}

const toDate = (value: string | null | undefined): Date | null =>
  value ? new Date(value) : null;

export const pullRows = (
  installationId: number,
  repoId: string,
  pull: QueuePull
): PullRows => {
  const id = pullRowId(repoId, pull.number);
  const reviewers = pull.reviewers.map((reviewer) => ({
    pullId: id,
    login: reviewer.name,
    kind: reviewer.kind,
    avatarUrl: reviewer.avatarUrl,
    state: reviewer.state,
    score: reviewer.score,
    submittedAt: toDate(reviewer.submittedAt),
  }));
  const checks: CheckRow[] = pull.ciFailures.map((failure) => ({
    pullId: id,
    name: failure.name,
    bucket: "failed",
    detailsUrl: failure.url,
  }));
  const threads = pull.threadPreviews.map((thread) => ({
    pullId: id,
    threadId: thread.id,
    isResolved: false,
    path: thread.path,
    rootCommentId: thread.rootCommentId,
    authorLogin: thread.author?.login ?? null,
    authorAvatarUrl: thread.author?.avatarUrl ?? null,
    bodyPreview: thread.body,
  }));
  return {
    pull: {
      id,
      repoId,
      installationId,
      number: pull.number,
      state: pull.state,
      title: pull.title,
      authorLogin: pull.author?.login ?? null,
      authorAvatarUrl: pull.author?.avatarUrl ?? null,
      isDraft: pull.isDraft,
      hasBody: pull.hasBody,
      baseRef: pull.baseRefName,
      headRef: pull.headRefName,
      additions: pull.additions,
      deletions: pull.deletions,
      changedFiles: pull.changedFiles,
      ciState: pull.ci,
      ciFailed: pull.ciCounts.failed,
      ciPassed: pull.ciCounts.passed,
      ciPending: pull.ciCounts.pending,
      unresolvedThreads: pull.unresolvedThreads,
      decision: pull.decision,
      blocker: pull.blocker,
      mergedAt: toDate(pull.mergedAt),
      ghUpdatedAt: new Date(pull.updatedAt),
    },
    reviewers,
    checks,
    threads,
  };
};

export const gapRows = (
  installationId: number,
  repoId: string,
  flow: RepoFlow
): { gaps: GapRow[]; gapPulls: GapPullRow[] } => {
  const gaps: GapRow[] = [];
  const gapPulls: GapPullRow[] = [];
  for (const gap of flow.gaps) {
    gaps.push({
      repoId,
      installationId,
      fromStage: gap.from,
      toStage: gap.to,
      aheadBy: gap.aheadBy,
      directCommits: gap.directCommits,
      promotionPull: gap.promotionPull,
    });
    for (const pull of gap.pulls) {
      gapPulls.push({
        repoId,
        fromStage: gap.from,
        toStage: gap.to,
        number: pull.number,
        title: pull.title,
        body: pull.body,
        authorLogin: pull.author?.login ?? null,
        authorAvatarUrl: pull.author?.avatarUrl ?? null,
        mergedAt: toDate(pull.mergedAt),
      });
    }
  }
  return { gaps, gapPulls };
};
