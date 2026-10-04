import { describe, expect, test } from "bun:test";
import type { EvalJournalEntry } from "@sphynx/schema/domain/eval-trial";
import { validationExecution } from "@sphynx/schema/domain/eval-validations";
import { EMPTY_TRANSCRIPT, settle, transcribe } from "../../src/cli/transcript";
import { PLAIN } from "../../src/cli/transcript-writer";

const speaker = {
  caseName: "asks before it pushes",
  key: "cel_1#1",
  ordinal: null,
  variant: "codex/gpt-5.6-terra",
};

const other = { ...speaker, key: "cel_2#1", variant: "claude/opus" };

const said = (text: string, at: number): EvalJournalEntry => ({
  _tag: "message",
  finishedAtMillis: at,
  role: "user",
  text,
  usage: null,
});

const replied = (
  text: string,
  at: number,
  costUsd: number | null = null
): EvalJournalEntry => ({
  _tag: "message",
  finishedAtMillis: at,
  role: "assistant",
  text,
  usage:
    costUsd === null
      ? null
      : {
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          costUsd,
          inputTokens: 1,
          outputTokens: 1,
          totalTokens: 2,
        },
});

const tool = (name: string, input: string): EvalJournalEntry => ({
  _tag: "toolCall",
  finishedAtMillis: null,
  input,
  name,
  status: null,
});

const check = (
  name: string,
  status: "passed" | "failed",
  message: string,
  durationMs: number
) => ({
  ...validationExecution(
    { id: name, index: 0, kind: "code" as const, name },
    null
  ),
  durationMs,
  message,
  status,
});

const verdict = (
  status: string,
  validations: ReturnType<typeof check>[] = []
) => ({ status, validations, verifySteps: [], voidFields: [] });

const run = (entries: readonly EvalJournalEntry[], who = speaker) =>
  transcribe(
    EMPTY_TRANSCRIPT,
    entries.map((entry) => ({ entry, speaker: who })),
    PLAIN
  );

describe("the transcript a reader follows", () => {
  test("opens a trial with its case and variant", () => {
    const { lines } = run([said("go", 0)]);

    expect(lines.slice(0, 2)).toEqual([
      "",
      "  asks before it pushes  codex/gpt-5.6-terra",
    ]);
  });

  test("gives each speaker a block and keeps the whole message", () => {
    const long = "word ".repeat(60).trim();
    const { lines } = run([said(long, 0)]);
    const body = lines.filter((line) => line.startsWith("    "));

    expect(lines).toContain("  ❯ User");
    expect(body.length).toBeGreaterThan(1);
    expect(body.join(" ").replaceAll("    ", "").split(" ")).toHaveLength(60);
  });

  test("keeps the structure an agent wrote", () => {
    const { lines } = run([replied("[ ] one\n[X] two", 1)]);

    expect(lines).toContain("  ◆ Agent");
    expect(lines).toContain("    [ ] one");
    expect(lines).toContain("    [X] two");
  });

  test("names what a tool call acted on", () => {
    const { lines } = run([
      tool("skill", JSON.stringify({ skill: "autumn:autumn-setup" })),
    ]);

    expect(lines.at(-1)).toBe("    ├ skill   autumn:autumn-setup");
  });

  test("reads a command as what it did, and marks one that failed", () => {
    const ran = (command: string, exitCode: number, took: number) => ({
      _tag: "command" as const,
      command,
      exitCode,
      finishedAtMillis: took,
      output: "",
      startedAtMillis: 0,
    });
    const { lines } = run([
      ran("sed -n 1,200p skills/autumn-setup/SKILL.md", 0, 4),
      ran("npx tsc --noEmit", 2, 3100),
      {
        _tag: "fileChange",
        finishedAtMillis: 0,
        paths: ["src/autumn.config.ts"],
      },
    ]);

    expect(lines.slice(-3)).toEqual([
      "    ├ read    SKILL.md",
      "    ├ ran     npx tsc --noEmit  3.1s  ✗ exit 2",
      "    ├ wrote   autumn.config.ts",
    ]);
  });

  test("tints each kind of step its own colour in a terminal", () => {
    const ran = (command: string) => ({
      _tag: "command" as const,
      command,
      exitCode: 0,
      finishedAtMillis: 0,
      output: "",
      startedAtMillis: 0,
    });
    const { lines } = transcribe(
      EMPTY_TRANSCRIPT,
      [ran("cat a.ts"), ran("rg foo"), ran("npm test")].map((entry) => ({
        entry,
        speaker,
      })),
      { colour: true, width: 80 }
    );
    const tints = lines.slice(-3).map((line) => line.split("m")[2]);

    expect(new Set(tints).size).toBe(3);
  });

  test("closes a turn with its duration and spend when the next one opens", () => {
    const { lines } = run([
      said("hey", 1000),
      replied("what price?", 23_300, 0.04),
      said("$20", 30_000),
    ]);

    expect(lines).toContain("    └ turn 1 · 22.3s · $0.04");
  });

  test("closes the last turn once the trial settles", () => {
    const opened = run([said("hey", 0), replied("done", 5000)]);
    const { lines } = settle(
      opened.transcript,
      [{ speaker, verdict: verdict("passed") }],
      PLAIN
    );

    expect(lines).toEqual(["    └ turn 1 · 5.0s", "", "  ✓ passed"]);
    expect(settle(opened.transcript, [], PLAIN).lines).toEqual([]);
  });

  test("says when a turn ended without a reply", () => {
    const opened = run([said("hey", 0)]);
    const { lines } = settle(
      opened.transcript,
      [{ speaker, verdict: verdict("failed") }],
      PLAIN
    );

    expect(lines).toContain("    turn 1 · no reply");
  });

  test("says why a turn ended when the agent failed", () => {
    const opened = run([said("hey", 0)]);
    const { lines } = settle(
      opened.transcript,
      [
        {
          speaker,
          verdict: {
            ...verdict("void"),
            failure: "The agent failed: Free tier users do not have access",
          },
        },
      ],
      PLAIN
    );

    expect(lines).toEqual([
      "    turn 1 · The agent failed: Free tier users do not have access",
      "",
      "  ○ void · The agent failed: Free tier users do not have access",
    ]);
  });

  test("names the trial again whenever the speaker changes", () => {
    const first = run([said("a", 0)]);
    const { lines } = transcribe(
      first.transcript,
      [{ entry: said("b", 0), speaker: other }],
      PLAIN
    );

    expect(lines[0]).toBe("");
    expect(lines[1]).toContain("claude/opus");
  });

  test("paints for a terminal and never for a log", () => {
    const ansi = String.fromCharCode(27);

    expect(run([said("go", 0)]).lines.join("")).not.toContain(ansi);
    expect(
      transcribe(EMPTY_TRANSCRIPT, [{ entry: said("go", 0), speaker }], {
        colour: true,
        width: 80,
      }).lines.join("")
    ).toContain(ansi);
  });
});

describe("the verdict a trial closes with", () => {
  const settled = (status: string, checks: ReturnType<typeof check>[]) =>
    settle(
      run([said("hey", 0)]).transcript,
      [{ speaker, verdict: verdict(status, checks) }],
      PLAIN
    ).lines;

  test("counts the checks and lists only the ones that failed, with why", () => {
    const lines = settled("failed", [
      check("asked before applying", "passed", "asked first", 2),
      check("pushed with --yes", "failed", "never ran atmn push", 157),
    ]);

    expect(lines.slice(-3)).toEqual([
      "  ✗ failed · 1 of 2 checks passed",
      "    ✗ pushed with --yes · 157ms",
      "      never ran atmn push",
    ]);
    expect(lines.join("\n")).not.toContain("asked before applying");
  });

  test("falls back to the verifier's steps when no check was recorded", () => {
    const lines = settle(
      run([said("hey", 0)]).transcript,
      [
        {
          speaker,
          verdict: {
            status: "passed",
            verifySteps: [{ command: "test -f pricing.md", exitCode: 0 }],
            voidFields: [],
          },
        },
      ],
      PLAIN
    ).lines;

    expect(lines.at(-1)).toBe("  ✓ passed · 1 of 1 checks passed");
  });

  test("says why a trial was void", () => {
    const lines = settle(
      EMPTY_TRANSCRIPT,
      [
        {
          speaker,
          verdict: {
            status: "void",
            verifySteps: [],
            voidFields: ["sandbox"],
          },
        },
      ],
      PLAIN
    ).lines;

    expect(lines.at(1)).toBe("  asks before it pushes  codex/gpt-5.6-terra");
    expect(lines.at(-1)).toBe("  ○ void · sandbox");
  });

  test("closes a trial once however often it is reported settled", () => {
    const first = settle(
      run([said("hey", 0)]).transcript,
      [{ speaker, verdict: verdict("passed") }],
      PLAIN
    );

    expect(
      settle(first.transcript, [{ speaker, verdict: verdict("passed") }], PLAIN)
        .lines
    ).toEqual([]);
  });
});
