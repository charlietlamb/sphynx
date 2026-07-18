import { HttpApiBuilder } from "@effect/platform";
import { Auth } from "@sphynx/auth";
import { Database } from "@sphynx/db/client";
import { SphynxApi } from "@sphynx/schema/api";
import { Unauthorized } from "@sphynx/schema/pull-request-views";
import { Config, Effect, Redacted } from "effect";
import { githubTokenFor } from "../auth/github-token";
import { GitHubConfig } from "../github/config";
import { PipelineCache } from "../github/pipeline-cache";
import { GitHubReviewQueue } from "../github/review-queue";

const OK = { ok: true };

export const ReviewQueueApiLive = HttpApiBuilder.group(
  SphynxApi,
  "reviewQueue",
  (handlers) =>
    Effect.gen(function* () {
      const queue = yield* GitHubReviewQueue;
      const cache = yield* PipelineCache;
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

      return handlers
        .handle("getPipeline", ({ headers }) =>
          githubToken(headers.cookie).pipe(Effect.flatMap(cache.get))
        )
        .handle("getDevPipeline", () =>
          Effect.gen(function* () {
            const token = appConfig.token;
            if (nodeEnv === "production" || token === undefined) {
              return yield* Effect.fail(
                new Unauthorized({ message: "Not available" })
              );
            }
            return yield* cache.get(Redacted.value(token));
          })
        )
        .handle("mergePull", ({ path, headers }) =>
          githubToken(headers.cookie).pipe(
            Effect.flatMap((token) =>
              queue
                .mergePull(path, token)
                .pipe(Effect.zipRight(cache.drop(token)))
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
                  Effect.tap(() => cache.drop(token)),
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
                .pipe(Effect.zipRight(cache.drop(token)))
            ),
            Effect.map(() => OK)
          )
        );
    })
);
