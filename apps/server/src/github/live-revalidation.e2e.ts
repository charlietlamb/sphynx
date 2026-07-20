import { FetchHttpClient } from "@effect/platform";
import { Effect, Layer } from "effect";
import { GitHubAppAuth, GitHubAppAuthLive } from "./app-auth";
import { GitHubConfigLive } from "./config";
import { GitHubPipelineLive } from "./pipeline";
import { PipelineCache, PipelineCacheLive } from "./pipeline-cache";
import { GitHubReviewQueueLive } from "./review-queue";

/**
 * Exercises the real revalidation path against live GitHub.
 *
 * Not part of the unit suite: it needs credentials and network. Run with
 *   bun run apps/server/src/github/live-revalidation.e2e.ts <installationId>
 * and read the span timings to confirm a warm read costs no rebuild.
 */
const installationId = Number(process.argv[2] ?? "147791198");

const GitHubLive = PipelineCacheLive.pipe(
  Layer.provideMerge(GitHubPipelineLive),
  Layer.provideMerge(Layer.mergeAll(GitHubReviewQueueLive, GitHubAppAuthLive)),
  Layer.provide(Layer.mergeAll(GitHubConfigLive, FetchHttpClient.layer))
);

const elapsed = <A, E, R>(label: string, effect: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const started = performance.now();
    const value = yield* effect;
    const ms = performance.now() - started;
    process.stdout.write(
      `${label.padEnd(28)} ${ms.toFixed(0).padStart(6)}ms\n`
    );
    return value;
  });

const program = Effect.gen(function* () {
  const app = yield* GitHubAppAuth;
  const cache = yield* PipelineCache;
  const credential = app.installationCredential(installationId);

  const first = yield* elapsed("queue (first paint)", cache.queue(credential));
  process.stdout.write(`  repos: ${first.repos.length}\n`);

  const cold = yield* elapsed("full pipeline (rail)", cache.get(credential));
  process.stdout.write(`  repos: ${cold.repos.length}\n`);

  yield* elapsed("warm read (cached)", cache.get(credential));
  yield* elapsed("warm read (cached)", cache.get(credential));

  process.stdout.write(
    "\nwaiting 46s so the entry goes stale, then reading again.\n" +
      "the read should return instantly and revalidate in the background.\n\n"
  );
  yield* Effect.sleep("46 seconds");

  yield* elapsed("stale read (served now)", cache.get(credential));
  yield* Effect.sleep("8 seconds");
  yield* elapsed("after revalidation", cache.get(credential));
}).pipe(Effect.provide(GitHubLive), Effect.scoped);

Effect.runPromise(program).catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
