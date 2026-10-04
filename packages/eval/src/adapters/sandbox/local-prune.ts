import { mkdtemp, readdir, rename, rm, stat, utimes } from "node:fs/promises";
import { join } from "node:path";
import { Clock, Duration, Effect, Option } from "effect";
import type { LocalRoots } from "./local-roots";

const ABANDONED_AFTER = Duration.hours(1);
const UNUSED_AFTER = Duration.days(30);
const RETIRED = "retired-";
const STAGED = "entry-";

const quietly = <A>(work: () => Promise<A>) =>
  Effect.tryPromise(work).pipe(Effect.ignore);

const entriesOf = (dir: string) =>
  Effect.tryPromise(() => readdir(dir)).pipe(
    Effect.map((names) => names.map((name) => join(dir, name))),
    Effect.orElseSucceed(() => [] as string[])
  );

const touchedAt = (path: string) =>
  Effect.tryPromise(() => stat(path)).pipe(
    Effect.map((found) => found.mtimeMs),
    Effect.option
  );

export const markUsed = (path: string) =>
  Effect.flatMap(Clock.currentTimeMillis, (now) =>
    quietly(() => utimes(path, now / 1000, now / 1000))
  );

const retire = (path: string, staging: string) =>
  quietly(async () => {
    await stat(path);
    const holder = await mkdtemp(join(staging, RETIRED));
    await rename(path, join(holder, "retired"));
  });

const olderThan = (path: string, age: Duration.Duration, now: number) =>
  Effect.map(touchedAt(path), (touched) =>
    Option.exists(touched, (at) => now - at > Duration.toMillis(age))
  );

const retireUnused = (store: string, staging: string, now: number) =>
  Effect.flatMap(entriesOf(store), (entries) =>
    Effect.forEach(
      entries,
      (entry) =>
        Effect.flatMap(olderThan(entry, UNUSED_AFTER, now), (unused) =>
          unused ? retire(entry, staging) : Effect.void
        ),
      { discard: true }
    )
  );

const sweepStaging = (staging: string, now: number) =>
  Effect.flatMap(entriesOf(staging), (entries) =>
    Effect.forEach(
      entries,
      (entry) =>
        Effect.gen(function* () {
          const name = entry.slice(staging.length + 1);
          const abandoned =
            name.startsWith(STAGED) &&
            (yield* olderThan(entry, ABANDONED_AFTER, now));

          if (name.startsWith(RETIRED) || abandoned) {
            yield* quietly(() => rm(entry, { force: true, recursive: true }));
          }
        }),
      { discard: true }
    )
  );

const dropNpmCaches = (installs: string) =>
  Effect.flatMap(entriesOf(installs), (entries) =>
    Effect.forEach(
      entries,
      (entry) =>
        quietly(() =>
          rm(join(entry, ".npm"), { force: true, recursive: true })
        ),
      { discard: true }
    )
  );

export const pruneLocal = (base: string, roots: LocalRoots) =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis;

    yield* retire(join(base, "home"), roots.staging);
    yield* retireUnused(roots.installs, roots.staging, now);
    yield* retireUnused(roots.cache, roots.staging, now);
    yield* retireUnused(roots.packages, roots.staging, now);
    yield* dropNpmCaches(roots.installs);
    yield* sweepStaging(roots.staging, now);
  }).pipe(Effect.withSpan("LocalSandbox.prune"));
