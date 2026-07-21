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

      const installationFor = (
        cookie: string | undefined,
        want: number | null
      ) =>
        readCredential(cookie, want).pipe(
          Effect.map((credential) =>
            installationIdFromCredentialId(credential.id)
          )
        );

      /**
       * Read `{ repos }` from Neon, materializing once if the installation has
       * never been seen. Steady state is a single indexed query; a cold
       * installation is backfilled from GitHub (also done eagerly on the install
       * webhook, so this path is rare) and re-read. The warm path reads once —
       * only an empty first read pays for the materialize and second read.
       */
      const readOrMaterialize = <T extends { repos: readonly unknown[] }>(
        cookie: string | undefined,
        want: number | null,
        read: (installationId: number) => Effect.Effect<T>
      ) =>
        installationFor(cookie, want).pipe(
          Effect.flatMap((installationId) => {
            if (installationId === null) {
              return Effect.succeed({ repos: [] } as unknown as T);
            }
            return read(installationId).pipe(
              Effect.flatMap((result) =>
                result.repos.length > 0
                  ? Effect.succeed(result)
                  : materializer
                      .materialize(installationId)
                      .pipe(Effect.zipRight(read(installationId)))
              )
            );
          })
        );

      const pipelineFor = (cookie: string | undefined, want: number | null) =>
        readOrMaterialize(cookie, want, reader.readPipeline);

      const queueFor = (cookie: string | undefined, want: number | null) =>
        readOrMaterialize(cookie, want, reader.readQueue);

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
        )
        .handle("resyncInstallation", ({ path, headers }) =>
          /**
           * Backfill an already-linked installation as if freshly connected.
           * `readCredential` authorizes: it only resolves an installation the
           * user can reach, so a request for an unreachable id resolves to a
           * different one and is ignored. Materialize is forked so the response
           * returns immediately; the SSE `dirty` signal repaints when rows land.
           */
          readCredential(headers.cookie, path.installationId).pipe(
            Effect.flatMap((credential) => {
              const resolved = installationIdFromCredentialId(credential.id);
              if (resolved !== path.installationId) {
                return Effect.succeed(OK);
              }
              return materializer
                .materialize(resolved)
                .pipe(Effect.forkDaemon, Effect.as(OK));
            })
          )
        );
    })
);
