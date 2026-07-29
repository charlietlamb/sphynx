import { Effect, Schema } from "effect";
import type { PromotedPull, QueuePull, RepoFlow, StageGap } from "./domain";
import {
  configFromEnv,
  type GitHubClient,
  makeGitHubClient,
} from "./githubClient";
import type { GitHubError } from "./githubErrors";
import {
  commitPullNumbers,
  dropStaleMiddleStages,
  stageChain,
} from "./pipelineHelpers";
import { makeReviewQueue, type ReviewQueue, repoKey } from "./reviewQueue";

const REFS_FRAGMENT = `
fragment RepoRefs on Repository {
  defaultBranchRef { name }
  dev: ref(qualifiedName: "refs/heads/dev") { name }
  staging: ref(qualifiedName: "refs/heads/staging") { name }
  main: ref(qualifiedName: "refs/heads/main") { name }
  master: ref(qualifiedName: "refs/heads/master") { name }
  production: ref(qualifiedName: "refs/heads/production") { name }
}`;

const RefSchema = Schema.NullOr(Schema.Struct({ name: Schema.String }));

const RepoRefsSchema = Schema.Struct({
  defaultBranchRef: RefSchema,
  dev: RefSchema,
  staging: RefSchema,
  main: RefSchema,
  master: RefSchema,
  production: RefSchema,
});

const BatchedRefsSchema = Schema.Record({
  key: Schema.String,
  value: Schema.NullOr(RepoRefsSchema),
});

type RepoRefs = typeof RepoRefsSchema.Type;

const CompareSchema = Schema.Struct({
  ahead_by: Schema.Number,
  commits: Schema.Array(
    Schema.Struct({
      commit: Schema.Struct({ message: Schema.String }),
    }),
  ),
});

/**
 * The `lookupPulls` GraphQL selection requests only
 * `{ number title mergedAt author { login avatarUrl } }` — no `body` — so this
 * decodes exactly that shape. It is mapped to the domain `PromotedPull` (which
 * carries `body`) with `body: null`, since a promoted pull is only ever rendered
 * by number/title in the gap view.
 */
const LookupPullSchema = Schema.NullOr(
  Schema.Struct({
    number: Schema.Number,
    title: Schema.String,
    mergedAt: Schema.NullishOr(Schema.String),
    author: Schema.NullOr(
      Schema.Struct({
        login: Schema.String,
        avatarUrl: Schema.String,
      }),
    ),
  }),
);

type LookupPull = NonNullable<typeof LookupPullSchema.Type>;

const toPromotedPull = (pull: LookupPull): PromotedPull => ({
  number: pull.number,
  title: pull.title,
  body: null,
  author: pull.author
    ? { login: pull.author.login, avatarUrl: pull.author.avatarUrl }
    : null,
  mergedAt: pull.mergedAt ?? null,
});

const MAX_GAP_PULLS = 20;

/** Repos rendered in the queue, most recently pushed first. */
const MAX_ACTIVE_REPOS = 12;

/**
 * The per-repo compare fan-out. Repos run wide and each repo's stage gaps run
 * in parallel within it; the product stays well under GitHub's 100-request
 * concurrency ceiling.
 */
const REPO_CONCURRENCY = 12;
const GAP_CONCURRENCY = 4;

function initialChain(refs: RepoRefs) {
  return stageChain({
    defaultBranch: refs.defaultBranchRef?.name ?? "main",
    hasDev: Boolean(refs.dev),
    hasStaging: Boolean(refs.staging),
    prod: refs.main?.name ?? refs.master?.name ?? refs.production?.name ?? null,
  });
}

const makePipelineBuilder = (client: GitHubClient, queue: ReviewQueue) => {
  const restCompare = (
    token: string,
    owner: string,
    repo: string,
    upper: string,
    lower: string,
  ) =>
    client.restJson(
      token,
      `/repos/${owner}/${repo}/compare/${encodeURIComponent(upper)}...${encodeURIComponent(lower)}?per_page=100`,
      CompareSchema,
      "Invalid compare response",
    );

  const lookupPulls = (
    token: string,
    owner: string,
    repo: string,
    numbers: readonly number[],
  ): Effect.Effect<PromotedPull[], GitHubError> => {
    if (numbers.length === 0) {
      return Effect.succeed([]);
    }
    const selections = numbers
      .map(
        (number, index) =>
          `pr${index}: pullRequest(number: ${number}) { number title mergedAt author { login avatarUrl } }`,
      )
      .join("\n");
    const document = `
query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    ${selections}
  }
}`;
    const schema = Schema.Struct({
      repository: Schema.NullOr(
        Schema.Record({
          key: Schema.String,
          value: LookupPullSchema,
        }),
      ),
    });
    return client.query(token, schema, document, { owner, name: repo }).pipe(
      Effect.map((data) =>
        Object.values(data.repository ?? {})
          .filter((node): node is LookupPull => node !== null)
          .map(toPromotedPull)
          .sort((a, b) => (b.mergedAt ?? "").localeCompare(a.mergedAt ?? "")),
      ),
    );
  };

  const gapFor = (
    token: string,
    owner: string,
    repo: string,
    lower: string,
    upper: string,
    openPulls: readonly QueuePull[],
  ): Effect.Effect<StageGap, GitHubError> =>
    restCompare(token, owner, repo, upper, lower).pipe(
      Effect.flatMap((compare) => {
        const { numbers, direct } = commitPullNumbers(
          compare.commits.map((entry) => entry.commit.message),
        );
        const promotion = openPulls.find(
          (pull) => pull.headRefName === lower && pull.baseRefName === upper,
        );
        return lookupPulls(
          token,
          owner,
          repo,
          numbers.slice(0, MAX_GAP_PULLS),
        ).pipe(
          Effect.map((pulls) => ({
            from: lower,
            to: upper,
            aheadBy: compare.ahead_by,
            pulls,
            directCommits: direct,
            promotionPull: promotion?.number ?? null,
          })),
        );
      }),
    );

  const refsForRepos = (
    repos: readonly { owner: string; repo: string }[],
    token: string,
  ): Effect.Effect<Map<string, RepoRefs>, GitHubError> => {
    if (repos.length === 0) {
      return Effect.succeed(new Map());
    }
    const selections = repos
      .map(
        (entry, index) =>
          `r${index}: repository(owner: ${JSON.stringify(entry.owner)}, name: ${JSON.stringify(entry.repo)}) { ...RepoRefs }`,
      )
      .join("\n");
    const document = `query {\n${selections}\n}\n${REFS_FRAGMENT}`;
    return client.query(token, BatchedRefsSchema, document, {}).pipe(
      Effect.map((data) => {
        const byRepo = new Map<string, RepoRefs>();
        repos.forEach((entry, index) => {
          const node = data[`r${index}`];
          if (node) {
            byRepo.set(repoKey(entry), node);
          }
        });
        return byRepo;
      }),
      Effect.withSpan("GitHubPipeline.refsForRepos"),
      Effect.annotateLogs({ repoCount: repos.length }),
    );
  };

  const flowFromRefs = (
    entry: { owner: string; repo: string; pulls: readonly QueuePull[] },
    refs: RepoRefs,
    token: string,
  ): Effect.Effect<RepoFlow, GitHubError> => {
    const initial = initialChain(refs);
    const middleCheck =
      initial.length === 3
        ? restCompare(
            token,
            entry.owner,
            entry.repo,
            initial[1] ?? "",
            initial[0] ?? "",
          ).pipe(
            Effect.map((compare) => compare.ahead_by),
            Effect.tapErrorCause((cause) =>
              Effect.logWarning("middle stage check failed", cause),
            ),
            Effect.orElseSucceed(() => null),
          )
        : Effect.succeed(null);
    return middleCheck.pipe(
      Effect.map((aheadOfMiddle) =>
        dropStaleMiddleStages(initial, aheadOfMiddle),
      ),
      Effect.flatMap((stages) => {
        const pairs = stages
          .slice(0, -1)
          .map((stage, index) => [stage, stages[index + 1] ?? ""] as const);
        return Effect.forEach(
          pairs,
          ([lower, upper]) =>
            gapFor(
              token,
              entry.owner,
              entry.repo,
              lower,
              upper,
              entry.pulls,
            ).pipe(
              Effect.tapErrorCause((cause) =>
                Effect.logWarning("gap computation failed", cause),
              ),
              Effect.orElseSucceed(
                (): StageGap => ({
                  from: lower,
                  to: upper,
                  aheadBy: 0,
                  pulls: [],
                  directCommits: 0,
                  promotionPull: null,
                }),
              ),
            ),
          { concurrency: GAP_CONCURRENCY },
        ).pipe(
          Effect.map((gaps) => ({
            owner: entry.owner,
            repo: entry.repo,
            stages: [...stages],
            openPulls: [...entry.pulls],
            gaps,
          })),
        );
      }),
    );
  };

  const flowsFor = (
    entries: readonly {
      owner: string;
      repo: string;
      pulls: readonly QueuePull[];
    }[],
    token: string,
  ): Effect.Effect<RepoFlow[], GitHubError> =>
    refsForRepos(entries, token).pipe(
      Effect.flatMap((refsByRepo) =>
        Effect.forEach(
          entries,
          (entry) => {
            const refs = refsByRepo.get(repoKey(entry));
            return refs
              ? flowFromRefs(entry, refs, token).pipe(
                  Effect.tapErrorCause((cause) =>
                    Effect.logWarning("repo flow failed", cause),
                  ),
                  Effect.orElseSucceed(() => null),
                )
              : Effect.succeed(null);
          },
          { concurrency: REPO_CONCURRENCY },
        ),
      ),
      Effect.map((flows) =>
        flows.filter((flow): flow is RepoFlow => flow !== null),
      ),
      Effect.withSpan("GitHubPipeline.flowsFor"),
      Effect.annotateLogs({ repoCount: entries.length }),
    );

  const buildFrom = (
    discovered: readonly { owner: string; repo: string }[],
    token: string,
  ): Effect.Effect<RepoFlow[], GitHubError> =>
    Effect.gen(function* () {
      const pullsByRepo = yield* queue.openPullsForRepos(discovered, token);
      const entries = discovered.map((entry) => ({
        owner: entry.owner,
        repo: entry.repo,
        pulls: pullsByRepo.get(repoKey(entry)) ?? [],
      }));
      return yield* flowsFor(entries, token);
    }).pipe(Effect.withSpan("GitHubPipeline.buildFrom"));

  return { buildFrom } as const;
};

/**
 * Discover an installation's repos, fetch their open pulls, and build each
 * repo's stage-gap flow — the full pipeline `pipeline.refresh(token, null)`
 * produced, without the conditional-ETag revalidation (there is no cross-request
 * ETag store here; every build is a cold read).
 *
 * Only repos with open pulls reach the expensive per-repo compare fan-out, and
 * the active set is capped, matching the server's `refresh` trimming.
 */
export const buildPipeline = (
  token: string,
): Effect.Effect<{ repos: RepoFlow[] }, GitHubError> =>
  Effect.gen(function* () {
    const client = makeGitHubClient(configFromEnv());
    const queue = makeReviewQueue(client);
    const builder = makePipelineBuilder(client, queue);

    const discovered = yield* queue.discoverRepos(token);
    const pullsByRepo = yield* queue.openPullsForRepos(discovered, token);
    const active = discovered
      .filter((entry) => (pullsByRepo.get(repoKey(entry))?.length ?? 0) > 0)
      .slice(0, MAX_ACTIVE_REPOS);
    const repos = yield* builder.buildFrom(active, token);
    return { repos };
  }).pipe(Effect.withSpan("GitHubPipeline.buildPipeline"));

/**
 * Repo discovery for the workbench seed: the installation's visible repos, most
 * recently pushed first.
 */
export const discoverRepos = (
  token: string,
): Effect.Effect<{ owner: string; repo: string }[], GitHubError> => {
  const client = makeGitHubClient(configFromEnv());
  return makeReviewQueue(client).discoverRepos(token);
};

/**
 * A repo's recent activity from the Events API — the one-time workbench feed
 * seed at backfill/resync.
 */
export const repoEvents = (
  entry: { owner: string; repo: string },
  token: string,
): Effect.Effect<readonly unknown[], GitHubError> => {
  const client = makeGitHubClient(configFromEnv());
  return makeReviewQueue(client).repoEvents(entry, token);
};
