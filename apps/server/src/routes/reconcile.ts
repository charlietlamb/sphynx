import { Effect, Redacted } from "effect";
import { ServerConfig } from "../config";
import { Materializer } from "../github/materializer";

const RECONCILE_PATH = "/api/github/reconcile";

const BEARER_PREFIX = /^Bearer\s+/i;

export const isReconcilePath = (pathname: string) =>
  pathname === RECONCILE_PATH;

const respond = (status: number, body: string) =>
  new Response(body, { status, headers: { "content-type": "text/plain" } });

/**
 * The reconcile backstop, driven by Vercel Cron instead of an in-container
 * loop, so no always-on process is pinned by the sweep. Authorized by a shared
 * `CRON_SECRET` bearer token (Vercel Cron sends it automatically); a missing or
 * wrong secret is rejected so the endpoint is not publicly triggerable.
 *
 * The sweep is forked so the response returns immediately — the cron only needs
 * an ack, not the (slow) GitHub work to finish.
 */
export const handleReconcile = (request: Request) =>
  Effect.gen(function* () {
    const config = yield* ServerConfig;
    if (config.cronSecret === null) {
      return respond(503, "reconcile disabled");
    }
    const presented = request.headers
      .get("authorization")
      ?.replace(BEARER_PREFIX, "");
    if (presented !== Redacted.value(config.cronSecret)) {
      return respond(401, "unauthorized");
    }
    const materializer = yield* Materializer;
    yield* materializer.reconcileOnce.pipe(
      Effect.tapErrorCause((cause) =>
        Effect.logError("cron reconcile failed", cause)
      ),
      Effect.forkDaemon
    );
    return respond(202, "accepted");
  });
