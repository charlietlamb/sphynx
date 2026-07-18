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
import { GitHubReviewQueue } from "../../github/review-queue";
import { githubTokenFor } from "../github-token";

const OK = { ok: true };

const PIPELINE_TTL = Duration.minutes(10);
const PIPELINE_REFRESH_MS = 45_000;
const MARK_RETENTION_MS = Duration.toMillis(PIPELINE_TTL);

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
        pipeline.build(token).pipe(Effect.map((repos) => ({ repos })));

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

      const markStale = (token: string, now: number) =>
        Ref.modify(refreshMarks, (marks) => {
          const last = marks.get(token) ?? 0;
          if (now - last <= PIPELINE_REFRESH_MS) {
            return [false, marks] as const;
          }
          const next = new Map<string, number>();
          for (const [key, at] of marks) {
            if (now - at <= MARK_RETENTION_MS) {
              next.set(key, at);
            }
          }
          next.set(token, now);
          return [true, next] as const;
        });

      const cachedPipeline = (token: string) =>
        Effect.gen(function* () {
          const value = yield* pipelineCache
            .get(token)
            .pipe(Effect.tapError(() => pipelineCache.invalidate(token)));
          const now = yield* Clock.currentTimeMillis;
          const shouldRefresh = yield* markStale(token, now);
          if (shouldRefresh) {
            yield* Effect.forkDaemon(
              pipelineCache.refresh(token).pipe(
                Effect.tapErrorCause((cause) =>
                  Effect.logWarning("pipeline refresh failed", cause)
                ),
                Effect.ignore
              )
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
