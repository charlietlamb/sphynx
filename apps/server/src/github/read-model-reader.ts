import { Database } from "@sphynx/db/client";
import {
  type reviewCheck,
  type reviewPull,
  reviewRepo,
  type reviewReviewer,
  type reviewThread,
  type stageGap,
  type stageGapPull,
  workbenchEvent,
} from "@sphynx/db/schema";
import type {
  Pipeline,
  Queue,
  QueuePull,
  RepoFlow,
  ReviewerVerdict,
  StageGap,
} from "@sphynx/schema/review-queue";
import type { WorkbenchEvent, WorkbenchFeed } from "@sphynx/schema/workbench";
import { and, desc, eq, sql } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";

type PullRow = typeof reviewPull.$inferSelect;
type RepoRow = typeof reviewRepo.$inferSelect;
type ReviewerRow = typeof reviewReviewer.$inferSelect;
type CheckRow = typeof reviewCheck.$inferSelect;
type ThreadRow = typeof reviewThread.$inferSelect;
type GapRow = typeof stageGap.$inferSelect;
type GapPullRow = typeof stageGapPull.$inferSelect;
type WorkbenchRow = typeof workbenchEvent.$inferSelect;

const WORKBENCH_KINDS = new Set<WorkbenchEvent["kind"]>([
  "pr-opened",
  "pr-merged",
  "pr-closed",
  "pr-reopened",
  "pr-ready",
  "review-approved",
  "review-changes",
  "review-commented",
  "comment",
  "push",
  "branch-created",
  "branch-deleted",
  "release",
]);

const isWorkbenchKind = (value: string): value is WorkbenchEvent["kind"] =>
  WORKBENCH_KINDS.has(value as WorkbenchEvent["kind"]);

/**
 * ISO string from a timestamp, tolerant of both shapes the reader receives: a
 * `Date` (node-pg parses top-level timestamp columns) and a string (JSON
 * aggregates serialize timestamps to ISO already).
 */
const iso = (value: Date | string | null): string | null => {
  if (value === null) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : value;
};

const groupBy = <T>(rows: readonly T[], key: (row: T) => string) => {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const id = key(row);
    const bucket = map.get(id);
    if (bucket) {
      bucket.push(row);
    } else {
      map.set(id, [row]);
    }
  }
  return map;
};

const toVerdictState = (state: string): ReviewerVerdict["state"] => {
  if (state === "approved") {
    return "approved";
  }
  if (state === "changes-requested") {
    return "changes-requested";
  }
  return "commented";
};

const toVerdict = (row: ReviewerRow): ReviewerVerdict => ({
  name: row.login,
  kind: row.kind === "bot" ? "bot" : "human",
  avatarUrl: row.avatarUrl,
  state: toVerdictState(row.state),
  score: row.score,
  submittedAt: iso(row.submittedAt) ?? "",
});

const toCiState = (value: string): QueuePull["ci"] => {
  switch (value) {
    case "success":
      return "success";
    case "failure":
      return "failure";
    case "pending":
      return "pending";
    default:
      return "none";
  }
};

const toPullState = (value: string): QueuePull["state"] => {
  if (value === "merged") {
    return "merged";
  }
  if (value === "closed") {
    return "closed";
  }
  return "open";
};

const toQueuePull = (
  row: PullRow,
  reviewers: readonly ReviewerRow[],
  checks: readonly CheckRow[],
  threads: readonly ThreadRow[]
): QueuePull => {
  const verdicts = reviewers
    .map(toVerdict)
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    owner: "",
    repo: "",
    number: row.number,
    title: row.title,
    hasBody: row.hasBody,
    author: row.authorLogin
      ? { login: row.authorLogin, avatarUrl: row.authorAvatarUrl ?? "" }
      : null,
    isDraft: row.isDraft,
    state: toPullState(row.state),
    mergedAt: iso(row.mergedAt),
    updatedAt: iso(row.ghUpdatedAt) ?? "",
    additions: row.additions,
    deletions: row.deletions,
    changedFiles: row.changedFiles,
    ci: toCiState(row.ciState),
    headRefName: row.headRef,
    baseRefName: row.baseRef,
    reviewers: verdicts,
    reviewerCount: verdicts.length,
    botReviewerCount: verdicts.filter((v) => v.kind === "bot").length,
    approvals: verdicts.filter((v) => v.state === "approved").length,
    changesRequested: verdicts.filter((v) => v.state === "changes-requested")
      .length,
    unresolvedThreads: row.unresolvedThreads,
    ciFailures: checks.map((check) => ({
      name: check.name,
      url: check.detailsUrl,
    })),
    ciCounts: {
      failed: row.ciFailed,
      passed: row.ciPassed,
      pending: row.ciPending,
    },
    threadPreviews: threads.map((thread) => ({
      author: thread.authorLogin
        ? {
            login: thread.authorLogin,
            avatarUrl: thread.authorAvatarUrl ?? "",
          }
        : null,
      body: thread.bodyPreview,
      id: thread.threadId,
      path: thread.path,
      rootCommentId: thread.rootCommentId,
    })),
    decision:
      row.decision === "ready" ||
      row.decision === "contested" ||
      row.decision === "draft"
        ? row.decision
        : "needs-eyes",
    blocker: row.blocker,
  };
};

const withOwner = (
  pull: QueuePull,
  owner: string,
  repo: string
): QueuePull => ({
  ...pull,
  owner,
  repo,
});

const toGap = (row: GapRow, pulls: readonly GapPullRow[]): StageGap => ({
  from: row.fromStage,
  to: row.toStage,
  aheadBy: row.aheadBy,
  directCommits: row.directCommits,
  promotionPull: row.promotionPull,
  pulls: pulls.map((pull) => ({
    number: pull.number,
    title: pull.title,
    body: pull.body,
    author: pull.authorLogin
      ? { login: pull.authorLogin, avatarUrl: pull.authorAvatarUrl ?? "" }
      : null,
    mergedAt: iso(pull.mergedAt),
  })),
});

/** Events served per repo feed. Beyond this is scrollback nobody reads. */
const WORKBENCH_LIMIT = 100;

const toWorkbenchEventFromRow = (row: WorkbenchRow): WorkbenchEvent | null => {
  if (!isWorkbenchKind(row.kind)) {
    return null;
  }
  return {
    id: row.id,
    at: row.occurredAt.toISOString(),
    actor: {
      login: row.actor ?? "unknown",
      avatarUrl: row.actorAvatarUrl ?? "",
    },
    kind: row.kind,
    pull:
      row.pullNumber === null
        ? null
        : { number: row.pullNumber, title: row.title },
    detail: row.detail,
    url: row.url,
  };
};

interface PullWithChildren extends PullRow {
  readonly checks: CheckRow[];
  readonly reviewers: ReviewerRow[];
  readonly threads: ThreadRow[];
}

/**
 * Every open pull for the installation, each with its reviewers/checks/threads
 * pre-aggregated as JSON in ONE query. Correlated subqueries mean one round-trip
 * instead of the four (pulls → reviewers/checks/threads) the per-table version
 * cost. `json_build_object` keys are camelCase so the parsed rows match the
 * drizzle row types the mappers expect. `to_json` on the timestamps yields ISO
 * strings, which `new Date(...)` in the mappers accepts.
 */
const openPullsWithChildren = (db: Database["Type"], installationId: number) =>
  Effect.tryPromise(() =>
    db.execute(sql`
      SELECT
        p.id, p.repo_id AS "repoId", p.installation_id AS "installationId",
        p.number, p.state, p.title, p.author_login AS "authorLogin",
        p.author_avatar_url AS "authorAvatarUrl", p.is_draft AS "isDraft",
        p.has_body AS "hasBody", p.base_ref AS "baseRef", p.head_ref AS "headRef",
        p.additions, p.deletions, p.changed_files AS "changedFiles",
        p.ci_state AS "ciState", p.ci_failed AS "ciFailed",
        p.ci_passed AS "ciPassed", p.ci_pending AS "ciPending",
        p.unresolved_threads AS "unresolvedThreads", p.decision, p.blocker,
        p.merged_at AS "mergedAt", p.gh_updated_at AS "ghUpdatedAt",
        COALESCE((
          SELECT json_agg(json_build_object(
            'pullId', r.pull_id, 'login', r.login, 'kind', r.kind,
            'avatarUrl', r.avatar_url, 'state', r.state, 'score', r.score,
            'submittedAt', r.submitted_at
          )) FROM review_reviewer r WHERE r.pull_id = p.id
        ), '[]'::json) AS reviewers,
        COALESCE((
          SELECT json_agg(json_build_object(
            'pullId', c.pull_id, 'name', c.name, 'bucket', c.bucket,
            'detailsUrl', c.details_url, 'completedAt', c.completed_at
          )) FROM review_check c WHERE c.pull_id = p.id
        ), '[]'::json) AS checks,
        COALESCE((
          SELECT json_agg(json_build_object(
            'pullId', t.pull_id, 'threadId', t.thread_id,
            'isResolved', t.is_resolved, 'path', t.path,
            'rootCommentId', t.root_comment_id, 'authorLogin', t.author_login,
            'authorAvatarUrl', t.author_avatar_url, 'bodyPreview', t.body_preview
          )) FROM review_thread t WHERE t.pull_id = p.id
        ), '[]'::json) AS threads
      FROM review_pull p
      WHERE p.installation_id = ${installationId} AND p.state = 'open'
      ORDER BY p.number
    `)
  ).pipe(
    Effect.orDie,
    Effect.map((result) => result.rows as unknown as PullWithChildren[])
  );

interface GapWithPulls extends GapRow {
  readonly gapPulls: GapPullRow[];
}

const makeReadModelReader = Effect.gen(function* () {
  const db = yield* Database;

  const reposFor = (installationId: number) =>
    Effect.tryPromise(() =>
      db
        .select()
        .from(reviewRepo)
        .where(eq(reviewRepo.installationId, installationId))
    ).pipe(Effect.orDie);

  /** Every stage gap for the installation with its promoted pulls, in one query. */
  const gapsWithPulls = (installationId: number) =>
    Effect.tryPromise(() =>
      db.execute(sql`
        SELECT
          g.repo_id AS "repoId", g.installation_id AS "installationId",
          g.from_stage AS "fromStage", g.to_stage AS "toStage",
          g.ahead_by AS "aheadBy", g.direct_commits AS "directCommits",
          g.promotion_pull AS "promotionPull", g.computed_at AS "computedAt",
          COALESCE((
            SELECT json_agg(json_build_object(
              'repoId', gp.repo_id, 'fromStage', gp.from_stage,
              'toStage', gp.to_stage, 'number', gp.number, 'title', gp.title,
              'body', gp.body, 'authorLogin', gp.author_login,
              'authorAvatarUrl', gp.author_avatar_url, 'mergedAt', gp.merged_at
            )) FROM stage_gap_pull gp
            WHERE gp.repo_id = g.repo_id AND gp.from_stage = g.from_stage
              AND gp.to_stage = g.to_stage
          ), '[]'::json) AS "gapPulls"
        FROM stage_gap g
        WHERE g.installation_id = ${installationId}
      `)
    ).pipe(
      Effect.orDie,
      Effect.map((result) => result.rows as unknown as GapWithPulls[])
    );

  const pullsByRepoId = (pulls: readonly PullWithChildren[]) => {
    const byRepo = new Map<string, QueuePull[]>();
    for (const pull of pulls) {
      const built = toQueuePull(
        pull,
        pull.reviewers,
        pull.checks,
        pull.threads
      );
      const bucket = byRepo.get(pull.repoId);
      if (bucket) {
        bucket.push(built);
      } else {
        byRepo.set(pull.repoId, [built]);
      }
    }
    return byRepo;
  };

  const queueFlows = (
    repos: readonly RepoRow[],
    byRepo: Map<string, QueuePull[]>
  ) =>
    repos
      .map((repo) => ({
        repo,
        pulls: (byRepo.get(repo.id) ?? []).map((pull) =>
          withOwner(pull, repo.owner, repo.repo)
        ),
      }))
      .filter((entry) => entry.pulls.length > 0);

  const readQueue = (installationId: number): Effect.Effect<Queue> =>
    Effect.gen(function* () {
      const [pulls, repos] = yield* Effect.all([
        openPullsWithChildren(db, installationId),
        reposFor(installationId),
      ]);
      const byRepo = pullsByRepoId(pulls);
      return {
        repos: queueFlows(repos, byRepo).map((entry) => ({
          owner: entry.repo.owner,
          repo: entry.repo.repo,
          openPulls: entry.pulls,
        })),
      };
    }).pipe(
      Effect.withSpan("ReadModelReader.readQueue"),
      Effect.annotateLogs({ "github.installation": installationId })
    );

  const readPipeline = (installationId: number): Effect.Effect<Pipeline> =>
    Effect.gen(function* () {
      const [pulls, repos, gaps] = yield* Effect.all([
        openPullsWithChildren(db, installationId),
        reposFor(installationId),
        gapsWithPulls(installationId),
      ]);
      const byRepo = pullsByRepoId(pulls);
      const gapsByRepo = groupBy(gaps, (row) => row.repoId);
      const flows: RepoFlow[] = queueFlows(repos, byRepo).map((entry) => ({
        owner: entry.repo.owner,
        repo: entry.repo.repo,
        stages: entry.repo.stages,
        openPulls: entry.pulls,
        gaps: (gapsByRepo.get(entry.repo.id) ?? []).map((gap) =>
          toGap(gap, gap.gapPulls)
        ),
      }));
      return { repos: flows };
    }).pipe(
      Effect.withSpan("ReadModelReader.readPipeline"),
      Effect.annotateLogs({ "github.installation": installationId })
    );

  /**
   * The workbench feed for one repo, newest first, from the read model. The
   * viewer is per-request (the signed-in user's login), not stored, so the
   * caller supplies it.
   */
  const readWorkbench = (
    installationId: number,
    ref: { owner: string; repo: string },
    viewer: string | null
  ): Effect.Effect<WorkbenchFeed> =>
    Effect.tryPromise(() =>
      db
        .select()
        .from(workbenchEvent)
        .where(
          and(
            eq(workbenchEvent.installationId, installationId),
            eq(workbenchEvent.owner, ref.owner),
            eq(workbenchEvent.repo, ref.repo)
          )
        )
        .orderBy(desc(workbenchEvent.occurredAt))
        .limit(WORKBENCH_LIMIT)
    ).pipe(
      Effect.orDie,
      Effect.map((rows) => ({
        events: rows.flatMap((row) => {
          const event = toWorkbenchEventFromRow(row);
          return event ? [event] : [];
        }),
        viewer,
      })),
      Effect.withSpan("ReadModelReader.readWorkbench"),
      Effect.annotateLogs({
        "github.installation": installationId,
        "github.repo": `${ref.owner}/${ref.repo}`,
      })
    );

  return { readQueue, readPipeline, readWorkbench };
});

export class ReadModelReader extends Context.Tag(
  "@sphynx/server/ReadModelReader"
)<ReadModelReader, Effect.Effect.Success<typeof makeReadModelReader>>() {}

export const ReadModelReaderLive = Layer.effect(
  ReadModelReader,
  makeReadModelReader
);
