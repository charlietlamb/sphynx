import { HttpApiBuilder } from "@effect/platform";
import { Auth } from "@sphynx/auth";
import { Database } from "@sphynx/db/client";
import { SphynxApi } from "@sphynx/schema/api";
import { Unauthorized } from "@sphynx/schema/pull-request-views";
import type { Pipeline } from "@sphynx/schema/review-queue";
import { Cache, Clock, Config, Duration, Effect, Redacted, Ref } from "effect";
import { GitHubConfig } from "../../github/config";
import type { GitHubAuthedError } from "../../github/graphql";
import { GitHubPipeline } from "../../github/pipeline";
import { GitHubReviewQueue, repoKey } from "../../github/review-queue";
import { githubTokenFor } from "../github-token";

const OK = { ok: true };

const PIPELINE_TTL = Duration.minutes(10);
const PIPELINE_REFRESH_MS = 45_000;

export const ReviewQueueApiLive = HttpApiBuilder.group(
  SphynxApi,
  "reviewQueue",
  (handlers) =>
    Effect.gen(function* () {
      const queue = yield* GitHubReviewQueue;
      const pipeline = yield* GitHubPipeline;
      const auth = yield* Auth;
      const db = yield* Database;
      const nodeEnv = yield* Config.string("NODE_ENV").pipe(
        Config.withDefault("development")
      );
      const appConfig = yield* GitHubConfig;
      const githubToken = githubTokenFor(
        auth,
        db,
        "Sign in to use the review queue"
      );

      const buildPipeline = (
        token: string
      ): Effect.Effect<Pipeline, GitHubAuthedError> =>
        Effect.gen(function* () {
          const discovered = yield* queue.discoverRepos(token);
          const pullsByRepo = yield* queue.openPullsForRepos(discovered, token);
          const entries = discovered.map((entry) => ({
            owner: entry.owner,
            repo: entry.repo,
            pulls: pullsByRepo.get(repoKey(entry)) ?? [],
          }));
          const repos = yield* pipeline.flowsFor(entries, token);
          return { repos };
        }).pipe(Effect.withSpan("ReviewQueueApi.buildPipeline"));

      const pipelineCache = yield* Cache.make({
        capacity: 64,
        timeToLive: PIPELINE_TTL,
        lookup: buildPipeline,
      });

      const refreshMarks = yield* Ref.make(new Map<string, number>());

      const dropCached = (token: string) =>
        pipelineCache.invalidate(token).pipe(
          Effect.zipRight(
            Ref.update(refreshMarks, (previous) => {
              const next = new Map(previous);
              next.delete(token);
              return next;
            })
          )
        );

      const cachedPipeline = (token: string) =>
        Effect.gen(function* () {
          const value = yield* pipelineCache
            .get(token)
            .pipe(Effect.tapError(() => pipelineCache.invalidate(token)));
          const now = yield* Clock.currentTimeMillis;
          const marks = yield* Ref.get(refreshMarks);
          if (now - (marks.get(token) ?? 0) > PIPELINE_REFRESH_MS) {
            yield* Ref.update(refreshMarks, (previous) =>
              new Map(previous).set(token, now)
            );
            yield* Effect.forkDaemon(
              pipelineCache.refresh(token).pipe(Effect.ignore)
            );
          }
          return value;
        });

      return handlers
        .handle("getPipeline", ({ headers }) =>
          githubToken(headers.cookie).pipe(Effect.flatMap(cachedPipeline))
        )
        .handle("getDevPipeline", () =>
          Effect.gen(function* () {
            const token = appConfig.token;
            if (nodeEnv === "production" || token === undefined) {
              return yield* Effect.fail(
                new Unauthorized({ message: "Not available" })
              );
            }
            return yield* cachedPipeline(Redacted.value(token));
          })
        )
        .handle("mergePull", ({ path, headers }) =>
          githubToken(headers.cookie).pipe(
            Effect.flatMap((token) =>
              queue
                .mergePull(path, token)
                .pipe(Effect.zipRight(dropCached(token)))
            ),
            Effect.map(() => OK)
          )
        )
        .handle("createPromotion", ({ path, headers, payload }) =>
          githubToken(headers.cookie).pipe(
            Effect.flatMap((token) =>
              queue
                .createPull(
                  path.owner,
                  path.repo,
                  payload.from,
                  payload.to,
                  `Release ${payload.from} to ${payload.to}`,
                  token
                )
                .pipe(
                  Effect.tap(() => dropCached(token)),
                  Effect.map((number) => ({ number }))
                )
            )
          )
        )
        .handle("blockPull", ({ path, headers, payload }) =>
          githubToken(headers.cookie).pipe(
            Effect.flatMap((token) =>
              queue
                .blockPull(path, payload.body, token)
                .pipe(Effect.zipRight(dropCached(token)))
            ),
            Effect.map(() => OK)
          )
        );
    })
);
