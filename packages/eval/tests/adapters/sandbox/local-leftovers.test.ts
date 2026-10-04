import { afterAll, describe, expect, it } from "bun:test";
import {
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  rm,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ResolvedCredential } from "@sphynx/schema/domain/credentials";
import { ConfigProvider, Effect, Option, Redacted } from "effect";
import {
  installHarness,
  npmInstall,
} from "../../../src/adapters/harness/install";
import { makeLocalAdapter } from "../../../src/adapters/sandbox/local";
import { pruneLocal } from "../../../src/adapters/sandbox/local-prune";

const roots: string[] = [];

afterAll(() =>
  Promise.all(roots.map((root) => rm(root, { force: true, recursive: true })))
);

const freshRoot = async () => {
  const root = await mkdtemp(join(tmpdir(), "sphynx-leftovers-"));
  roots.push(root);
  return root;
};

const DAY_SECONDS = 86_400;

const aged = async (path: string, days: number) => {
  const at = Date.now() / 1000 - days * DAY_SECONDS;
  await utimes(path, at, at);
};

const made = async (path: string) => {
  await mkdir(path, { recursive: true });
  await writeFile(join(path, "marker"), "x");
  return path;
};

const listed = async (path: string) => (await readdir(path)).sort();

const FAKE_NPM = `#!/bin/sh
prefix=""; cache="$HOME/.npm"
while [ $# -gt 0 ]; do
  case "$1" in
    --prefix) prefix="$2"; shift;;
    --cache) cache="$2"; shift;;
  esac
  shift
done
mkdir -p "$cache/_cacache" && echo blob > "$cache/_cacache/blob"
mkdir -p "$prefix/bin" && printf '#!/bin/sh\\necho ran\\n' > "$prefix/bin/fake" && chmod +x "$prefix/bin/fake"
`;

describe("what a local run leaves on disk", () => {
  it("publishes a harness install without the npm cache it used", async () => {
    const root = await freshRoot();
    const bin = await made(join(root, "bin"));
    await writeFile(join(bin, "npm"), FAKE_NPM);
    await chmod(join(bin, "npm"), 0o755);

    await Effect.runPromise(
      Effect.gen(function* () {
        const adapter = yield* makeLocalAdapter;
        const sandbox = yield* adapter.open({
          autoStopMinutes: 1,
          provider: "local",
          workspace: join(root, "work"),
        });

        yield* installHarness("gemini", npmInstall("fake-agent"), {
          credential: Redacted.make({} as unknown as ResolvedCredential),
          home: sandbox.home,
          profile: Option.none(),
          sandbox,
          version: "1.0.0",
        });
      }).pipe(
        Effect.withConfigProvider(
          ConfigProvider.fromMap(
            new Map([
              ["SPHYNX_LOCAL_SANDBOX", "true"],
              ["SPHYNX_LOCAL_ROOT", join(root, "store")],
              ["PATH", `${bin}:/usr/bin:/bin`],
            ])
          )
        )
      )
    );

    expect(await listed(join(root, "store/harness/gemini_401.0.0"))).toEqual([
      ".local",
    ]);
  });

  it("clears the old shared home, crashed staging, stale entries and unused package caches, and keeps what is in use", async () => {
    const base = await freshRoot();
    const installs = join(base, "harness");
    const cache = join(base, "cache");
    const staging = join(base, "staging");
    const packages = join(base, "packages");

    await made(join(base, "home/Library"));
    await made(join(packages, "npm"));
    await aged(join(packages, "npm"), 45);
    await made(join(packages, "bun"));
    await made(join(installs, "codex_40.1.0/.local"));
    await made(join(installs, "codex_40.1.0/.npm"));
    await aged(join(installs, "codex_40.1.0"), 45);
    await made(join(installs, "codex_40.2.0/.local"));
    await made(join(installs, "codex_40.2.0/.npm"));
    await made(join(cache, "old-case"));
    await aged(join(cache, "old-case"), 45);
    await made(join(cache, "fresh-case"));
    await made(join(staging, "entry-crashed"));
    await aged(join(staging, "entry-crashed"), 1);
    await made(join(staging, "entry-installing"));

    await Effect.runPromise(
      pruneLocal(base, { cache, installs, packages, staging })
    );

    expect(await listed(base)).toEqual([
      "cache",
      "harness",
      "packages",
      "staging",
    ]);
    expect(await listed(packages)).toEqual(["bun"]);
    expect(await listed(installs)).toEqual(["codex_40.2.0"]);
    expect(await listed(join(installs, "codex_40.2.0"))).toEqual([".local"]);
    expect(await listed(cache)).toEqual(["fresh-case"]);
    expect(await listed(staging)).toEqual(["entry-installing"]);
  });
});
