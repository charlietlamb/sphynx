import { describe, expect, test } from "bun:test";
import type { EvalJournalEntry } from "@anpord/schema/domain/eval-trial";
import {
  countConversation,
  writtenPaths,
} from "@/lib/evals/conversation-totals";

const TRAJECTORY = [
  { _tag: "message", finishedAtMillis: 1, role: "user", text: "Set up Pro." },
  { _tag: "message", finishedAtMillis: 2, role: "assistant", text: "On it." },
  {
    _tag: "command",
    command: "npx atmn pull",
    exitCode: 0,
    finishedAtMillis: 3,
    output: "",
    startedAtMillis: 2,
  },
  {
    _tag: "command",
    command: "npx atmn push",
    exitCode: 1,
    finishedAtMillis: 5,
    output: "",
    startedAtMillis: 4,
  },
  {
    _tag: "toolCall",
    finishedAtMillis: 6,
    name: "catalog.get",
    startedAtMillis: 5,
    status: "completed",
  },
  { _tag: "message", finishedAtMillis: 7, role: "user", text: "yes" },
] satisfies EvalJournalEntry[];

describe("countConversation", () => {
  test("counts turns, calls, failures and files", () => {
    expect(countConversation(TRAJECTORY, ["a.ts", "b.ts"])).toEqual({
      commands: 2,
      failed: 1,
      files: 2,
      toolCalls: 1,
      turns: 2,
    });
  });
});

describe("writtenPaths", () => {
  test("lists each path once, captured files first", () => {
    expect(writtenPaths([{ path: "a.ts" }], ["b.ts", "a.ts"])).toEqual([
      "a.ts",
      "b.ts",
    ]);
  });
});
