import { afterAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConfigProvider, Effect } from "effect";
import { makeLocalAdapter } from "../../../src/adapters/sandbox/local";
import { runCommandForOutcome } from "../../../src/adapters/sandbox/run-command";

const roots: string[] = [];

afterAll(() =>
  Promise.all(roots.map((root) => rm(root, { force: true, recursive: true })))
);

const PRINT_ENV =
  'printf "%s\\n%s\\n%s\\n" "$BUN_INSTALL_CACHE_DIR" "$npm_config_cache" "$TMPDIR"';

const envOfOneSandbox = (root: string, name: string) =>
  Effect.gen(function* () {
    const adapter = yield* makeLocalAdapter;
    const sandbox = yield* adapter.open({
      autoStopMinutes: 1,
      provider: "local",
      workspace: join(root, name),
    });
    const outcome = yield* runCommandForOutcome(sandbox, PRINT_ENV, {
      timeoutMs: 10_000,
    });
    const [bun = "", npm = "", temp = ""] = outcome.stdout.trim().split("\n");
    return { bun, npm, temp };
  }).pipe(
    Effect.withConfigProvider(
      ConfigProvider.fromMap(
        new Map([
          ["SPHYNX_LOCAL_SANDBOX", "true"],
          ["SPHYNX_LOCAL_ROOT", join(root, "store")],
        ])
      ).pipe(ConfigProvider.orElse(() => ConfigProvider.fromEnv()))
    )
  );

describe("package caches in local sandboxes", () => {
  it("share one bun and npm cache across trials, with a temp dir each", async () => {
    const root = await mkdtemp(join(tmpdir(), "sphynx-package-cache-"));
    roots.push(root);

    const [first, second] = await Effect.runPromise(
      Effect.all([envOfOneSandbox(root, "one"), envOfOneSandbox(root, "two")])
    );

    expect(first?.bun).toBe(join(root, "store", "packages", "bun"));
    expect(first?.npm).toBe(join(root, "store", "packages", "npm"));
    expect(second?.bun).toBe(first?.bun);
    expect(second?.npm).toBe(first?.npm);
    expect(first?.temp).not.toBe(second?.temp);
    expect((await stat(first?.temp ?? "")).isDirectory()).toBe(true);
  });
});
