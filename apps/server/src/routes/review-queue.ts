import { HttpApiBuilder } from "@effect/platform";
import { SphynxApi } from "@sphynx/schema/api";
import { INSTALLATION_HEADER } from "@sphynx/schema/review-queue";
import { Effect } from "effect";
import { GitHubAuth } from "../auth/github-auth";
import { installationIdFromCredentialId } from "../github/credential";
import { Materializer } from "../github/materializer";
import { ReadModelReader } from "../github/read-model-reader";
import { GitHubReviewQueue } from "../github/review-queue";
import { SearchCache } from "../github/search-cache";

const OK = { ok: true };

export const ReviewQueueApiLive = HttpApiBuilder.group(
  SphynxApi,
  "reviewQueue",
  (handlers) =>
    Effect.gen(function* () {
      const queue = yield* GitHubReviewQueue;
      const reader = yield* ReadModelReader;
      const materializer = yield* Materializer;
      const search = yield* SearchCache;
      const { listInstallations, readCredential, readToken, writeToken } =
        yield* GitHubAuth;

      /**
       * Writes act as the signed-in user so GitHub attributes them correctly.
       * The write triggers a GitHub webhook, which the projector materializes
       * into the read model within ~1s — so there is no in-process cache to
       * invalidate here.
       */
      const mutate = <A, E>(
        cookie: string | undefined,
        run: (token: string) => Effect.Effect<A, E>
      ) => writeToken(cookie).pipe(Effect.flatMap(run));

      /** The client names an installation; a bad value falls back server-side. */
      const requested = (headers: Record<string, string | undefined>) => {
        const raw = headers[INSTALLATION_HEADER];
        const parsed = raw ? Number(raw) : Number.NaN;
        return Number.isInteger(parsed) ? parsed : null;
      };

      /**
       * Resolve the installation for a read, materializing it once if it has
       * never been seen. Steady state is a single indexed Neon query; a cold
       * installation is backfilled from GitHub (also done eagerly on the install
       * webhook, so this path is rare) and then read from rows like any other.
       */
      const installationFor = (
        cookie: string | undefined,
        want: number | null
      ) =>
        readCredential(cookie, want).pipe(
          Effect.map((credential) =>
            installationIdFromCredentialId(credential.id)
          )
        );

      const ensureMaterialized = (installationId: number) =>
        reader
          .readPipeline(installationId)
          .pipe(
            Effect.flatMap((pipeline) =>
              pipeline.repos.length > 0
                ? Effect.void
                : materializer.materialize(installationId)
            )
          );

      const pipelineFor = (cookie: string | undefined, want: number | null) =>
        installationFor(cookie, want).pipe(
          Effect.flatMap((installationId) =>
            installationId === null
              ? Effect.succeed({ repos: [] })
              : ensureMaterialized(installationId).pipe(
                  Effect.zipRight(reader.readPipeline(installationId))
                )
          )
        );

      const queueFor = (cookie: string | undefined, want: number | null) =>
        installationFor(cookie, want).pipe(
          Effect.flatMap((installationId) =>
            installationId === null
              ? Effect.succeed({ repos: [] })
              : ensureMaterialized(installationId).pipe(
                  Effect.zipRight(reader.readQueue(installationId))
                )
          )
        );

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
          pipelineFor(headers.cookie, requested(headers))
        )
        .handle("getQueue", ({ headers }) =>
          queueFor(headers.cookie, requested(headers))
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
