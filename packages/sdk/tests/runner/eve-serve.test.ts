import { afterEach, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serveEve } from "../../src/runner/eve";

let scratch: string | undefined;

afterEach(async () => {
  if (scratch !== undefined) {
    await rm(scratch, { force: true, recursive: true });
  }
});

const fakeEve = async (lines: readonly string[]) => {
  const dir = await mkdtemp(join(tmpdir(), "sphynx-eve-serve-"));
  const bin = join(dir, "node_modules/.bin/eve");
  await mkdir(join(dir, "node_modules/.bin"), { recursive: true });
  await writeFile(bin, ["#!/bin/sh", ...lines].join("\n"));
  await chmod(bin, 0o755);
  scratch = dir;
  return dir;
};

const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

test("says what eve printed when it exits before it serves", async () => {
  const dir = await fakeEve([
    "echo '☰eve  v0.58.1'",
    "echo 'Failed to evaluate authored module:' >&2",
    "echo '  agent/agent.ts' >&2",
    "exit 1",
  ]);

  const failure = await serveEve({ cwd: dir }).then(
    () => "served",
    (error: Error) => error.message
  );

  expect(failure).toBe(
    "eve dev exited with code 1: Failed to evaluate authored module: agent/agent.ts"
  );
});

test("eve dev goes down with the process group a timed out trial loses", async () => {
  const pidFile = join(tmpdir(), `sphynx-eve-${process.pid}-${Date.now()}.pid`);
  const dir = await fakeEve([`echo $$ > "${pidFile}"`, "exec sleep 30"]);
  const serve = join(import.meta.dir, "../../src/runner/eve/serve.ts");
  const trial = spawn(
    process.execPath,
    [
      "-e",
      `import(${JSON.stringify(serve)}).then(({ serveEve }) => serveEve({ cwd: ${JSON.stringify(dir)} }))`,
    ],
    { detached: true, stdio: "ignore" }
  );

  while (!existsSync(pidFile)) {
    await Bun.sleep(50);
  }
  const eve = Number((await readFile(pidFile, "utf8")).trim());
  await rm(pidFile, { force: true });

  process.kill(-(trial.pid ?? 0), "SIGKILL");
  await Bun.sleep(300);

  expect(isAlive(eve)).toBe(false);
});

test("keeps a line eve wrote in two pieces whole", async () => {
  const dir = await fakeEve([
    "printf 'Failed to evaluate auth' >&2",
    "sleep 0.2",
    "printf 'ored module: agent/agent.ts\\n' >&2",
    "exit 1",
  ]);

  const failure = await serveEve({ cwd: dir }).then(
    () => "served",
    (error: Error) => error.message
  );

  expect(failure).toBe(
    "eve dev exited with code 1: Failed to evaluate authored module: agent/agent.ts"
  );
});
