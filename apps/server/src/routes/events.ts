import { Effect, Schedule, Stream } from "effect";
import { GitHubAuth } from "../auth/github-auth";
import { installationIdFromCredentialId } from "../github/credential";
import { EventBus } from "../github/event-bus";

const EVENTS_PATH = "/api/github/events";

export const isEventsPath = (pathname: string) => pathname === EVENTS_PATH;

const HEARTBEAT_MS = 25_000;

const encoder = new TextEncoder();

const sseHeaders = {
  "content-type": "text/event-stream",
  "cache-control": "no-cache, no-transform",
  connection: "keep-alive",
};

/**
 * Server-sent events for one installation. Two event types share the stream:
 * `dirty` (the read model moved — invalidate the dashboard/queue/workbench) and
 * `pull` (a PR's head moved — the PR page refetches that pull). Heartbeats keep
 * proxies from closing an idle stream.
 */
export const handleEvents = (request: Request) =>
  Effect.gen(function* () {
    const { readCredential } = yield* GitHubAuth;
    const bus = yield* EventBus;
    const cookie = request.headers.get("cookie") ?? undefined;
    const raw = new URL(request.url).searchParams.get("installation");
    const wanted = raw && Number.isInteger(Number(raw)) ? Number(raw) : null;

    const credential = yield* readCredential(cookie, wanted).pipe(
      Effect.catchAll(() => Effect.succeed(null))
    );
    const installationId = credential
      ? installationIdFromCredentialId(credential.id)
      : null;
    if (installationId === null) {
      return new Response("unauthorized", { status: 401 });
    }

    const runtime = yield* Effect.runtime<never>();
    const dirty = bus
      .subscribe(installationId)
      .pipe(
        Stream.map(
          () => `event: dirty\ndata: ${JSON.stringify({ installationId })}\n\n`
        )
      );
    const pulls = bus.subscribePull(installationId).pipe(
      Stream.map(
        (event) =>
          `event: pull\ndata: ${JSON.stringify({
            owner: event.owner,
            repo: event.repo,
            number: event.number,
            headSha: event.headSha,
          })}\n\n`
      )
    );
    const heartbeats = Stream.repeatValue(": heartbeat\n\n").pipe(
      Stream.schedule(Schedule.spaced(`${HEARTBEAT_MS} millis`))
    );

    const body = Stream.merge(Stream.merge(dirty, pulls), heartbeats).pipe(
      Stream.map((chunk) => encoder.encode(chunk)),
      Stream.toReadableStreamRuntime(runtime)
    );

    return new Response(body, { headers: sseHeaders });
  });
