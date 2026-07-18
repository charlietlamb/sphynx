import { HttpClient, HttpClientRequest } from "@effect/platform";
import { GitHubUnavailable } from "@sphynx/schema/pull-requests";
import type {
  PromotedPull,
  QueuePull,
  RepoFlow,
  StageGap,
} from "@sphynx/schema/review-queue";
import { Context, Effect, Layer, Schema } from "effect";
import { GitHubConfig } from "./config";
import { type GitHubAuthedError, makeGraphql } from "./graphql";
import { repoKey } from "./review-queue";

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
    })
  ),
});

const PromotedNodeSchema = Schema.Struct({
  number: Schema.Number,
  title: Schema.String,
  mergedAt: Schema.NullOr(Schema.String),
  author: Schema.NullOr(
    Schema.Struct({ login: Schema.String, avatarUrl: Schema.String })
  ),
});

const PR_NUMBER_PATTERN = /#(\d+)\b/;
const MAX_GAP_PULLS = 20;

export function commitPullNumbers(messages: readonly string[]) {
  const numbers: number[] = [];
  let direct = 0;
  const seen = new Set<number>();
  for (const message of messages) {
    const firstLine = message.split("\n")[0] ?? "";
    const match = PR_NUMBER_PATTERN.exec(firstLine);
    if (match) {
      const number = Number(match[1]);
      if (!seen.has(number)) {
        seen.add(number);
        numbers.push(number);
      }
    } else {
      direct += 1;
    }
  }
  return { numbers, direct };
}

export function stageChain(refs: {
  defaultBranch: string;
  hasDev: boolean;
  hasStaging: boolean;
  prod: string | null;
}) {
  if (!refs.hasDev) {
    return [refs.defaultBranch];
  }
  const stages = ["dev"];
  if (refs.hasStaging) {
    stages.push("staging");
  }
  if (refs.prod && refs.prod !== "dev") {
    stages.push(refs.prod);
  }
  return stages;
}

const STALE_STAGE_THRESHOLD = 300;

export function dropStaleMiddleStages(
  stages: readonly string[],
  aheadOfMiddle: number | null
) {
  if (
    stages.length === 3 &&
    aheadOfMiddle !== null &&
    aheadOfMiddle > STALE_STAGE_THRESHOLD
  ) {
    const first = stages[0];
    const last = stages[2];
    return first && last ? [first, last] : [...stages];
  }
  return [...stages];
}

function initialChain(refs: RepoRefs) {
  return stageChain({
    defaultBranch: refs.defaultBranchRef?.name ?? "main",
    hasDev: Boolean(refs.dev),
    hasStaging: Boolean(refs.staging),
    prod: refs.main?.name ?? refs.master?.name ?? refs.production?.name ?? null,
  });
}

const makeGitHubPipeline = Effect.gen(function* () {
  const config = yield* GitHubConfig;
  const client = yield* HttpClient.HttpClient;
  const github = makeGraphql(config, client);

  const restCompare = (
    token: string,
    owner: string,
    repo: string,
    upper: string,
    lower: string
  ) =>
    Effect.gen(function* () {
      const outgoing = HttpClientRequest.get(
        `${config.apiUrl}/repos/${owner}/${repo}/compare/${encodeURIComponent(upper)}...${encodeURIComponent(lower)}?per_page=100`
      ).pipe(
        HttpClientRequest.bearerToken(token),
        HttpClientRequest.setHeaders({
          accept: "application/vnd.github+json",
          "x-github-api-version": config.apiVersion,
        })
      );
      const response = yield* client
        .execute(outgoing)
        .pipe(
          Effect.mapError(
            () => new GitHubUnavailable({ message: "GitHub is unreachable" })
          )
        );
      if (response.status >= 400) {
        return yield* Effect.fail(
          new GitHubUnavailable({
            message: `Compare failed with ${response.status}`,
          })
        );
      }
      const body = yield* response.json.pipe(
        Effect.mapError(
          () => new GitHubUnavailable({ message: "Invalid compare response" })
        )
      );
      return yield* Schema.decodeUnknown(CompareSchema)(body).pipe(
        Effect.mapError(
          () => new GitHubUnavailable({ message: "Invalid compare response" })
        )
      );
    }).pipe(
      Effect.timeoutFail({
        duration: config.timeout,
        onTimeout: () =>
          new GitHubUnavailable({ message: "GitHub request timed out" }),
      })
    );

  const lookupPulls = (
    token: string,
    owner: string,
    repo: string,
    numbers: readonly number[]
  ): Effect.Effect<PromotedPull[], GitHubAuthedError> => {
    if (numbers.length === 0) {
      return Effect.succeed([]);
    }
    const selections = numbers
      .map(
        (number, index) =>
          `pr${index}: pullRequest(number: ${number}) { number title mergedAt author { login avatarUrl } }`
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
          value: Schema.NullOr(PromotedNodeSchema),
        })
      ),
    });
    return github.query(token, schema, document, { owner, name: repo }).pipe(
      Effect.map((data) => {
        const repository = data.repository ?? {};
        const pulls: PromotedPull[] = [];
        for (const node of Object.values(repository)) {
          if (node) {
            pulls.push({
              number: node.number,
              title: node.title,
              author: node.author,
              mergedAt: node.mergedAt,
            });
          }
        }
        return pulls.sort((a, b) =>
          (b.mergedAt ?? "").localeCompare(a.mergedAt ?? "")
        );
      })
    );
  };

  const gapFor = (
    token: string,
    owner: string,
    repo: string,
    lower: string,
    upper: string,
    openPulls: readonly QueuePull[]
  ): Effect.Effect<StageGap, GitHubAuthedError> =>
    restCompare(token, owner, repo, upper, lower).pipe(
      Effect.flatMap((compare) => {
        const { numbers, direct } = commitPullNumbers(
          compare.commits.map((entry) => entry.commit.message)
        );
        const promotion = openPulls.find(
          (pull) => pull.headRefName === lower && pull.baseRefName === upper
        );
        return lookupPulls(
          token,
          owner,
          repo,
          numbers.slice(0, MAX_GAP_PULLS)
        ).pipe(
          Effect.map((pulls) => ({
            from: lower,
            to: upper,
            aheadBy: compare.ahead_by,
            pulls,
            directCommits: direct,
            promotionPull: promotion?.number ?? null,
          }))
        );
      })
    );

  const refsForRepos = (
    repos: readonly { owner: string; repo: string }[],
    token: string
  ): Effect.Effect<Map<string, RepoRefs>, GitHubAuthedError> => {
    if (repos.length === 0) {
      return Effect.succeed(new Map());
    }
    const selections = repos
      .map(
        (entry, index) =>
          `r${index}: repository(owner: ${JSON.stringify(entry.owner)}, name: ${JSON.stringify(entry.repo)}) { ...RepoRefs }`
      )
      .join("\n");
    const document = `query {\n${selections}\n}\n${REFS_FRAGMENT}`;
    return github.query(token, BatchedRefsSchema, document, {}).pipe(
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
      Effect.annotateLogs({ repoCount: repos.length })
    );
  };

  const flowFromRefs = (
    entry: { owner: string; repo: string; pulls: readonly QueuePull[] },
    refs: RepoRefs,
    token: string
  ): Effect.Effect<RepoFlow, GitHubAuthedError> => {
    const initial = initialChain(refs);
    const middleCheck =
      initial.length === 3
        ? restCompare(
            token,
            entry.owner,
            entry.repo,
            initial[1] ?? "",
            initial[0] ?? ""
          ).pipe(
            Effect.map((compare) => compare.ahead_by),
            Effect.orElseSucceed(() => null)
          )
        : Effect.succeed(null);
    return middleCheck.pipe(
      Effect.map((aheadOfMiddle) =>
        dropStaleMiddleStages(initial, aheadOfMiddle)
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
              entry.pulls
            ).pipe(
              Effect.orElseSucceed(
                (): StageGap => ({
                  from: lower,
                  to: upper,
                  aheadBy: 0,
                  pulls: [],
                  directCommits: 0,
                  promotionPull: null,
                })
              )
            ),
          { concurrency: 2 }
        ).pipe(
          Effect.map((gaps) => ({
            owner: entry.owner,
            repo: entry.repo,
            stages: [...stages],
            openPulls: [...entry.pulls],
            gaps,
          }))
        );
      })
    );
  };

  const flowsFor = (
    entries: readonly {
      owner: string;
      repo: string;
      pulls: readonly QueuePull[];
    }[],
    token: string
  ): Effect.Effect<RepoFlow[], GitHubAuthedError> =>
    refsForRepos(entries, token).pipe(
      Effect.flatMap((refsByRepo) =>
        Effect.forEach(
          entries,
          (entry) => {
            const refs = refsByRepo.get(repoKey(entry));
            return refs
              ? flowFromRefs(entry, refs, token).pipe(
                  Effect.orElseSucceed(() => null)
                )
              : Effect.succeed(null);
          },
          { concurrency: 4 }
        )
      ),
      Effect.map((flows) =>
        flows.filter((flow): flow is RepoFlow => flow !== null)
      ),
      Effect.withSpan("GitHubPipeline.flowsFor"),
      Effect.annotateLogs({ repoCount: entries.length })
    );

  return { flowsFor };
});

export class GitHubPipeline extends Context.Tag(
  "@sphynx/server/GitHubPipeline"
)<GitHubPipeline, Effect.Effect.Success<typeof makeGitHubPipeline>>() {}

export const GitHubPipelineLive = Layer.effect(
  GitHubPipeline,
  makeGitHubPipeline
);
