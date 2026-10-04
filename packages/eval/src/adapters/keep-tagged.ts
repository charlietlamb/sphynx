import { Effect, Predicate } from "effect";

export const keepTagged =
  <T extends string, F>(tag: T, fallback: (error: unknown) => F) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.mapError(effect, (error) =>
      Predicate.isTagged(error, tag) ? error : fallback(error)
    );
