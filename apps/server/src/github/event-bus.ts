import { Listener } from "@sphynx/db/listen";
import { Context, Effect, Layer, PubSub, Runtime, Stream } from "effect";

/** The channel the read-model writer/projector notifies after a change. */
export const DIRTY_CHANNEL = "review_dirty";

/** The channel a PR head-move notifies on, carrying the ref + new head sha. */
export const PULL_DIRTY_CHANNEL = "pull_dirty";

interface DirtyEvent {
  readonly installationId: number;
}

/**
 * A wildcard installation id: a dirty event carrying it wakes every subscriber
 * regardless of their installation. Used after a LISTEN reconnect, where any
 * notification during the gap was lost, so all clients must re-read.
 */
const ALL_INSTALLATIONS = -1;

export interface PullDirtyEvent {
  readonly headSha: string;
  readonly installationId: number;
  readonly number: number;
  readonly owner: string;
  readonly repo: string;
}

const parseInstallation = (payload: string | null): number | null => {
  if (payload === null) {
    return null;
  }
  const parsed = Number(payload);
  return Number.isInteger(parsed) ? parsed : null;
};

/** `<installationId>:<owner>/<repo>#<number>:<headSha>` */
const PULL_DIRTY = /^(\d+):([^/]+)\/([^#]+)#(\d+):(.*)$/;

export const encodePullDirty = (event: PullDirtyEvent): string =>
  `${event.installationId}:${event.owner}/${event.repo}#${event.number}:${event.headSha}`;

const parsePullDirty = (payload: string | null): PullDirtyEvent | null => {
  if (payload === null) {
    return null;
  }
  const match = PULL_DIRTY.exec(payload);
  if (!match) {
    return null;
  }
  return {
    installationId: Number(match[1]),
    owner: match[2] ?? "",
    repo: match[3] ?? "",
    number: Number(match[4]),
    headSha: match[5] ?? "",
  };
};

const makeEventBus = Effect.gen(function* () {
  const listener = yield* Listener;
  const dirty = yield* PubSub.unbounded<DirtyEvent>();
  const pulls = yield* PubSub.unbounded<PullDirtyEvent>();
  const runtime = yield* Effect.runtime<never>();

  yield* listener.listen(DIRTY_CHANNEL, (payload) => {
    const installationId = parseInstallation(payload);
    if (installationId !== null) {
      Runtime.runFork(runtime)(dirty.publish({ installationId }));
    }
  });
  yield* listener.listen(PULL_DIRTY_CHANNEL, (payload) => {
    const event = parsePullDirty(payload);
    if (event !== null) {
      Runtime.runFork(runtime)(pulls.publish(event));
    }
  });
  /**
   * After a LISTEN reconnect, notifications sent during the gap were lost, so
   * wake every subscriber to re-read. A wildcard dirty event is enough — the
   * dashboard reload is cheap and idempotent.
   */
  yield* listener.onReconnect(() => {
    Runtime.runFork(runtime)(
      dirty.publish({ installationId: ALL_INSTALLATIONS })
    );
  });
  yield* Effect.logInfo(
    `listening on ${DIRTY_CHANNEL} and ${PULL_DIRTY_CHANNEL}`
  );

  /** A stream of dirty events for one installation. */
  const subscribe = (installationId: number): Stream.Stream<DirtyEvent> =>
    Stream.unwrapScoped(
      Effect.map(dirty.subscribe, (subscription) =>
        Stream.fromQueue(subscription).pipe(
          Stream.filter(
            (event) =>
              event.installationId === installationId ||
              event.installationId === ALL_INSTALLATIONS
          )
        )
      )
    );

  /** A stream of PR head-move events for one installation. */
  const subscribePull = (
    installationId: number
  ): Stream.Stream<PullDirtyEvent> =>
    Stream.unwrapScoped(
      Effect.map(pulls.subscribe, (subscription) =>
        Stream.fromQueue(subscription).pipe(
          Stream.filter((event) => event.installationId === installationId)
        )
      )
    );

  return { subscribe, subscribePull };
});

export class EventBus extends Context.Tag("@sphynx/server/EventBus")<
  EventBus,
  Effect.Effect.Success<typeof makeEventBus>
>() {}

export const EventBusLive = Layer.scoped(EventBus, makeEventBus);
