import { afterEach, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serveEve } from "../../src/runner/eve";

let scratch: string | undefined;

afterEach(async () => {
  if (scratch !== undefined) {
    await rm(scratch, { force: true, recursive: true });
  }
});

test("says what eve printed when it exits before it serves", async () => {
  scratch = await mkdtemp(join(tmpdir(), "sphynx-eve-serve-"));
  const bin = join(scratch, "node_modules/.bin/eve");
  await mkdir(join(scratch, "node_modules/.bin"), { recursive: true });
  await writeFile(
    bin,
    [
      "#!/bin/sh",
      "echo '☰eve  v0.58.1'",
      "echo 'Failed to evaluate authored module:' >&2",
      "echo '  agent/agent.ts' >&2",
      "exit 1",
    ].join("\n")
  );
  await chmod(bin, 0o755);

  const failure = await serveEve({ cwd: scratch }).then(
    () => "served",
    (error: Error) => error.message
  );

  expect(failure).toBe(
    "eve dev exited with code 1: Failed to evaluate authored module: agent/agent.ts"
  );
});
