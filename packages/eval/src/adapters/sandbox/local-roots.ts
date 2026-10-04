import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { Config, Effect } from "effect";
import { pruneLocal } from "./local-prune";

export interface LocalRoots {
  readonly cache: string;
  readonly installs: string;
  readonly packages: string;
  readonly staging: string;
}

const ensure = (path: string) =>
  Effect.tryPromise({
    catch: (cause) =>
      new Error(`local sandbox cannot use ${path}: ${String(cause)}`),
    try: () => mkdir(path, { recursive: true }),
  }).pipe(Effect.orDie, Effect.as(path));

export const localRoots: Effect.Effect<LocalRoots> = Effect.gen(function* () {
  const base = yield* Config.string("SPHYNX_LOCAL_ROOT").pipe(
    Config.withDefault(join(homedir(), ".sphynx", "local")),
    Effect.orDie
  );

  const roots = {
    cache: yield* ensure(join(base, "cache")),
    installs: yield* ensure(join(base, "harness")),
    packages: yield* ensure(join(base, "packages")),
    staging: yield* ensure(join(base, "staging")),
  };

  yield* Effect.forkDaemon(pruneLocal(base, roots));

  return roots;
});
