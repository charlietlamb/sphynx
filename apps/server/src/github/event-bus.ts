import { Listener } from "@sphynx/db/listen";
import { Context, Effect, Layer, PubSub, Runtime, Stream } from "effect";

/** The channel the read-model writer/projector notifies after a change. */
export const DIRTY_CHANNEL = "review_dirty";

interface DirtyEvent {
  readonly installationId: number;
}

const parseInstallation = (payload: string | null): number | null => {
  if (payload === null) {
    return null;
  }
  const parsed = Number(payload);
  return Number.isInteger(parsed) ? parsed : null;
};

const makeEventBus = Effect.gen(function* () {
  const listener = yield* Listener;
  const pubsub = yield* PubSub.unbounded<DirtyEvent>();
  const runtime = yield* Effect.runtime<never>();

  yield* listener.listen(DIRTY_CHANNEL, (payload) => {
    const installationId = parseInstallation(payload);
    if (installationId !== null) {
      Runtime.runFork(runtime)(pubsub.publish({ installationId }));
    }
  });
  yield* Effect.logInfo(`listening on ${DIRTY_CHANNEL}`);

  /** A stream of dirty events for one installation. */
  const subscribe = (installationId: number): Stream.Stream<DirtyEvent> =>
    Stream.unwrapScoped(
      Effect.map(pubsub.subscribe, (subscription) =>
        Stream.fromQueue(subscription).pipe(
          Stream.filter((event) => event.installationId === installationId)
        )
      )
    );

  return { subscribe };
});

export class EventBus extends Context.Tag("@sphynx/server/EventBus")<
  EventBus,
  Effect.Effect.Success<typeof makeEventBus>
>() {}

export const EventBusLive = Layer.scoped(EventBus, makeEventBus);
