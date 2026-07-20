import { HttpApiBuilder } from "@effect/platform";
import { SphynxApi } from "@sphynx/schema/api";
import { INSTALLATION_HEADER } from "@sphynx/schema/review-queue";
import { Effect } from "effect";
import { GitHubAuth } from "../auth/github-auth";
import { PipelineCache } from "../github/pipeline-cache";
import { PipelineVersionCache } from "../github/pipeline-version-cache";
import { GitHubReviewQueue } from "../github/review-queue";
import { SearchCache } from "../github/search-cache";

const OK = { ok: true };

export const ReviewQueueApiLive = HttpApiBuilder.group(
  SphynxApi,
  "reviewQueue",
  (handlers) =>
    Effect.gen(function* () {
      const queue = yield* GitHubReviewQueue;
      const cache = yield* PipelineCache;
      const search = yield* SearchCache;
      const version = yield* PipelineVersionCache;
      const { listInstallations, readCredential, readToken, writeToken } =
        yield* GitHubAuth;

      /**
       * Writes act as the signed-in user so GitHub attributes them correctly,
       * then invalidate the installation-scoped pipeline cache.
       */
      const mutate = <A, E>(
        cookie: string | undefined,
        run: (token: string) => Effect.Effect<A, E>
      ) =>
        writeToken(cookie).pipe(
          Effect.flatMap(run),
          Effect.tap(() =>
            readCredential(cookie).pipe(Effect.flatMap(cache.drop))
          )
        );

      /** The client names an installation; a bad value falls back server-side. */
      const requested = (headers: Record<string, string | undefined>) => {
        const raw = headers[INSTALLATION_HEADER];
        const parsed = raw ? Number(raw) : Number.NaN;
        return Number.isInteger(parsed) ? parsed : null;
      };

      return handlers
        .handle("listInstallations", ({ headers }) =>
          listInstallations(headers.cookie).pipe(
            Effect.map((installations) => ({
              installations: installations.map((entry) => ({
                id: entry.id,
                accountLogin: entry.account?.login ?? "unknown",
                accountType: entry.account?.type ?? "Organization",
                avatarUrl: entry.account?.avatar_url ?? null,
                repositorySelection: entry.repository_selection,
              })),
            }))
          )
        )
        .handle("getPipeline", ({ headers }) =>
          readCredential(headers.cookie, requested(headers)).pipe(
            Effect.flatMap(cache.get)
          )
        )
        .handle("getPipelineVersion", ({ headers }) =>
          readCredential(headers.cookie, requested(headers)).pipe(
            Effect.flatMap(version.get)
          )
        )
        .handle("getPullBody", ({ path, headers }) =>
          readToken(headers.cookie, requested(headers)).pipe(
            Effect.flatMap((token) => queue.pullBody(path, token))
          )
        )
        .handle("searchPulls", ({ urlParams, headers }) =>
          readCredential(headers.cookie, requested(headers)).pipe(
            Effect.flatMap((credential) =>
              search.get(urlParams.q, urlParams.limit, credential)
            )
          )
        )
        .handle("mergePull", ({ path, headers }) =>
          mutate(headers.cookie, (token) => queue.mergePull(path, token)).pipe(
            Effect.map(() => OK)
          )
        )
        .handle("createPromotion", ({ path, headers, payload }) =>
          mutate(headers.cookie, (token) =>
            queue.createPull(
              path.owner,
              path.repo,
              payload.from,
              payload.to,
              `Release ${payload.from} to ${payload.to}`,
              token
            )
          ).pipe(Effect.map((number) => ({ number })))
        )
        .handle("blockPull", ({ path, headers, payload }) =>
          mutate(headers.cookie, (token) =>
            queue.blockPull(path, payload.body, token)
          ).pipe(Effect.map(() => OK))
        );
    })
);
