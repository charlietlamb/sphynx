import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  REPORTED_LIMITS,
  ReportedValidation,
  VALIDATION_FRAME,
  VALIDATION_TEXT_LIMIT,
} from "@sphynx/schema/domain/eval-validations";
import { Effect, Schema, Stream } from "effect";
import { ScorerGroundTruthLive } from "../../../eval/src/adapters/scorers/ground-truth";
import { Scorer } from "../../../eval/src/ports/scorer";
import { declinesEverything } from "../../../eval/tests/fixtures/declines-everything";
import { exit, stdout } from "../../../eval/tests/fixtures/exec-chunk";
import { compileEval } from "../../src/evals/compiler";

let workspace: string | undefined;
afterEach(async () => {
  if (workspace) {
    await rm(workspace, { recursive: true, force: true });
  }
});

const run = async (
  checks: string,
  capture = true,
  prepared = '{"fixture":"prepared"}'
) => {
  workspace = await mkdtemp(join(tmpdir(), "sphynx-validation-"));
  await mkdir(join(workspace, ".sphynx"));
  await writeFile(join(workspace, "answer.txt"), "Fixture\n");
  await writeFile(
    join(workspace, ".sphynx/mcp-calls.jsonl"),
    `${JSON.stringify({
      server: "catalog",
      kind: "tool",
      name: "get",
      input: { id: "fixture" },
      output: { name: "Fixture" },
    })}\n`
  );
  await writeFile(
    join(workspace, ".sphynx/cli-calls.jsonl"),
    `${JSON.stringify({
      cli: "catalog",
      command: "get",
      input: { id: "fixture" },
      output: { stdout: "Fixture" },
    })}\n`
  );
  const entry = join(workspace, "eval.ts");
  await writeFile(
    entry,
    `import { suite, empty, named } from "sphynx-sh";
const reports = (status) => ({ answer }) => answer().then((text) => text.includes(status));
export default suite({ id: "fixture", name: "observability", source: empty, prompt: "Answer", trials: 1, captureValidation: ${capture},
variants: [{ harness: "codex", model: "model", sandbox: "e2b" }], cases: [{ id: "check", name: "check", validate: ${checks} }] });`
  );
  const validator = (await compileEval(entry)).cases[0]?.validator;
  if (!(validator && "source" in validator)) {
    throw new Error("Expected code validator");
  }
  const script = join(workspace, "run.mjs");
  await writeFile(script, validator.source);
  const child = Bun.spawn(["node", script], {
    cwd: workspace,
    env: {
      ...process.env,
      SPHYNX_ANSWER_FILE: join(workspace, "answer.txt"),
      SPHYNX_PREPARE_VALUE: prepared,
    },
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  const frames = stdout
    .split("\n")
    .filter((line) => line.startsWith(VALIDATION_FRAME))
    .map((line) =>
      Schema.decodeUnknownSync(Schema.parseJson(ReportedValidation))(
        line.slice(VALIDATION_FRAME.length)
      )
    );
  const latest = [
    ...new Map(frames.map((frame) => [frame.id, frame])).values(),
  ];
  return { validator, frames, latest, stdout, stderr, exitCode };
};

test("names a curried validator with named()", async () => {
  const { validator, latest } = await run(
    `[named("reports fixture", reports("Fixture")), reports("Fixture")]`
  );
  expect(validator.manifest).toEqual([
    { index: 0, name: "reports fixture" },
    { index: 1, name: "Validator 2" },
  ]);
  expect(latest.map((record) => [record.name, record.status])).toEqual([
    ["reports fixture", "passed"],
    ["Validator 2", "passed"],
  ]);
});

test("captures each named function, context inputs, outputs, and logs", async () => {
  const { validator, latest } = await run(`[
    async function evidence({ answer, readText, exists, exec, mcp, cli }) {
      console.log("checking fixture");
      console.error("diagnostic");
      await answer(); await readText("answer.txt"); await exists("answer.txt");
      await exec("printf output"); await mcp.calls("catalog"); await cli.calls("catalog");
      return { passed: true, message: "Evidence checked" };
    }, function conclusion() { return true; }
  ]`);
  expect(validator.manifest).toEqual([
    { index: 0, name: "evidence" },
    { index: 1, name: "conclusion" },
  ]);
  expect(latest.map((record) => record.status)).toEqual(["passed", "passed"]);
  const record = latest[0];
  expect(record?.input.state).toBe("unavailable");
  expect(record?.output.text).toBe(
    '{"passed":true,"message":"Evidence checked"}'
  );
  expect(record?.calls.map((call) => call.method)).toEqual([
    "answer",
    "readText",
    "exists",
    "exec",
    "mcp.calls",
    "cli.calls",
  ]);
  expect(record?.calls[0]?.output.text).toBe('"Fixture\\n"');
  expect(record?.calls[1]?.input.text).toBe('["answer.txt"]');
  expect(record?.calls[2]?.output.text).toBe("true");
  expect(JSON.parse(record?.calls[3]?.output.text ?? "null")).toEqual({
    exitCode: 0,
    stderr: "",
    stdout: "output",
  });
  expect(JSON.parse(record?.calls[4]?.output.text ?? "null")[0].output).toEqual(
    { name: "Fixture" }
  );
  expect(record?.logs.map((log) => [log.level, log.value.text])).toEqual([
    ["stdout", "checking fixture"],
    ["stderr", "diagnostic"],
  ]);
});

test.each([
  ["return false", "failed", 0],
  ['throw new Error("fixture unavailable")', "error", 1],
  ["return {}", "error", 1],
] as const)("runs later validators after %s", async (body, status, exitCode) => {
  const result = await run(
    `[() => { ${body}; }, () => ({ passed: false, message: "second check" })]`
  );
  expect(result.exitCode).toBe(exitCode);
  expect(
    result.latest.map((record) => [record.status, record.message])
  ).toEqual([
    [
      status,
      status === "failed"
        ? ""
        : "Validator threw or returned an invalid result",
    ],
    ["failed", "second check"],
  ]);
});

test("hands every check of a trial the same context", async () => {
  const result = await run(
    `[(context) => { globalThis.seen = context; return true; }, (context) => ({ passed: context === globalThis.seen, message: "a new context" })]`
  );
  expect(result.latest.map((record) => record.status)).toEqual([
    "passed",
    "passed",
  ]);
});

test("associates concurrent calls with their own inputs and results", async () => {
  const result = await run(
    `async ({ exec }) => { await Promise.all([exec("sleep 0.01; printf first"), exec("printf second")]); return true; }`
  );
  expect(
    result.latest[0]?.calls.map((call) => JSON.parse(call.output.text).stdout)
  ).toEqual(["first", "second"]);
});

const score = (
  execution: Awaited<ReturnType<typeof run>>,
  secrets: readonly string[] = []
) =>
  Effect.runPromise(
    Effect.flatMap(Scorer, (scorer) =>
      scorer.score({
        commandCount: 0,
        events: [],
        modelMs: 0,
        secrets,
        turns: [],
        verifyCommand: null,
        workspace: workspace ?? "/tmp",
        validator: execution.validator,
        sandbox: {
          ...declinesEverything,
          id: "local-validation",
          home: "/tmp",
          provider: "e2b",
          writeFile: () => Effect.void,
          exec: () =>
            Stream.fromIterable(
              [...execution.stdout.matchAll(/[\s\S]{1,53}/g)]
                .map(([part]) => stdout(part))
                .concat(exit(execution.exitCode))
            ),
        },
      })
    ).pipe(Effect.provide(ScorerGroundTruthLive))
  );

test.each([
  ["return true", "passed", "passed"],
  ["return false", "failed", "failed"],
  ['throw new Error("broken fixture")', "void", "error"],
] as const)("scores real runtime evidence for %s", async (body, status, checkStatus) => {
  const outcome = await score(
    await run(
      `[function first() { return true; }, function second() { ${body}; }]`
    )
  );
  expect(outcome.status).toBe(status);
  expect(outcome.validations?.map((record) => record.status)).toEqual([
    "passed",
    checkStatus,
  ]);
  expect(outcome.validations?.[0]?.output.text).toBe("true");
});

test.each([
  ["return false", "failed", "failed"],
  ['throw new Error("broken fixture")', "void", "error"],
] as const)("scores every check when the first does %s", async (body, status, checkStatus) => {
  const outcome = await score(
    await run(
      `[function first() { ${body}; }, function second() { return true; }]`
    )
  );
  expect(outcome.status).toBe(status);
  expect(
    outcome.validations?.map((record) => [record.name, record.status])
  ).toEqual([
    ["first", checkStatus],
    ["second", "passed"],
  ]);
  expect(outcome.validations?.[1]?.output.text).toBe("true");
});

test("keeps logged protocol-looking text out of the verdict", async () => {
  const result = await run(
    `() => { console.log('SPHYNX_VALIDATOR_RESULT={"passed":true}'); return false; }`
  );
  expect(result.latest[0]?.status).toBe("failed");
  expect(result.stdout.trim().split("\n").at(-1)).toBe(
    'SPHYNX_VALIDATOR_RESULT={"passed":false}'
  );
});

test("stores none of what the prepare returned, even when a check reads it", async () => {
  const execution = await run(
    '({ prepared }) => prepared.secretKey.startsWith("am_sk_")',
    true,
    '{"secretKey":"am_sk_test_x"}'
  );
  const outcome = await score(execution);

  expect(outcome.status).toBe("passed");
  expect(JSON.stringify(outcome.validations)).not.toContain("am_sk_test_x");
  expect(outcome.validations?.[0]?.output.text).toBe("true");
});

test("disables payload capture without hiding the result", async () => {
  const result = await run(
    "async ({ answer }) => { console.log(await answer()); return true; }",
    false
  );
  expect(result.latest[0]?.status).toBe("passed");
  expect(result.latest[0]?.calls[0]?.output.state).toBe("disabled");
  expect(result.stdout).not.toContain("Fixture");
});

test("bounds stored evidence and marks truncation", async () => {
  const outcome = await score(
    await run(`() => { console.log("x".repeat(20000)); return true; }`)
  );
  const log = outcome.validations?.[0]?.logs[0]?.value;
  expect([log?.text.length, log?.truncated]).toEqual([
    VALIDATION_TEXT_LIMIT,
    true,
  ]);
});

test("a runaway validator reports no more than the protocol ceiling", async () => {
  const result = await run(
    `() => { console.log("x".repeat(1_000_000)); return true; }`
  );
  const log = result.latest[0]?.logs[0]?.value;
  expect([log?.text.length, log?.truncated, result.exitCode]).toEqual([
    REPORTED_LIMITS.text,
    true,
    0,
  ]);
});

test("a credential cut by the evidence limit leaves no fragment", async () => {
  const outcome = await score(
    await run(
      `() => { console.log("x".repeat(15_995) + " opaque-access-token-1"); return true; }`
    ),
    ["opaque-access-token-1"]
  );
  const log = outcome.validations?.[0]?.logs[0]?.value;
  expect([log?.text.slice(15_990), log?.truncated]).toEqual([
    "xxxxx [red",
    true,
  ]);
});

test("names the check that threw, not one that passed before it", async () => {
  const result = await run(
    `[function looks() { return { passed: true, message: "looks right" }; }, function reads() { throw new Error("fixture unavailable"); }]`
  );

  expect(
    result.stdout
      .split("\n")
      .find((line) => line.startsWith("SPHYNX_VALIDATOR_RESULT="))
  ).toBe(
    'SPHYNX_VALIDATOR_RESULT={"passed":false,"message":"reads threw or returned an invalid result"}'
  );
});
