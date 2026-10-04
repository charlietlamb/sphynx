import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import {
  HarnessProfile,
  PROFILE_LIMITS,
  ProfilePath,
} from "../../src/domain/harness-profile";
import { SuiteBatchRequest } from "../../src/public/evals-api";

const path = Schema.decodeUnknownSync(ProfilePath);

const requestWith = (task: Record<string, unknown>) => ({
  cases: [
    {
      id: "a-case",
      name: "case",
      variables: { task: "Fix it" },
      verify: "true",
    },
  ],
  suite: { id: "a-suite", name: "A suite", prompt: "{{task}}" },
  variants: [task],
  trials: 1,
});

const decode = (task: Record<string, unknown>) =>
  Schema.decodeUnknownSync(SuiteBatchRequest)(requestWith(task));

const opencode = {
  harness: "opencode",
  model: "anthropic/claude-sonnet-4.6",
  sandbox: "daytona",
};

describe("a profile's file paths", () => {
  for (const shipped of [
    "home/.config/opencode/opencode.json",
    "workspace/AGENTS.md",
    "workspace/a/b/c/deep.md",
  ]) {
    it(`ships ${shipped}`, () => {
      expect(path(shipped)).toBe(shipped);
    });
  }

  /* An interior segment is the one that got through: a check that guarded
     only the first and the last accepted `home/a/../../../etc/passwd`, and
     this string is joined onto the sandbox home and written. */
  for (const refused of [
    "workspace/../etc/passwd",
    "home/a/../../../etc/passwd",
    "home/a/../b",
    "workspace/./x",
    "home/a/./b",
    "home/..",
    "../workspace/AGENTS.md",
    "/etc/passwd",
    "other/AGENTS.md",
    "AGENTS.md",
    "workspace/",
    "home//a",
  ]) {
    it(`refuses ${refused}`, () => {
      expect(() => path(refused)).toThrow();
    });
  }

  it("refuses a path past the length limit", () => {
    expect(() => path(`workspace/${"a".repeat(512)}`)).toThrow();
  });
});

describe("which harness a profile fits", () => {
  it("takes a profile on an existing base", () => {
    const task = {
      ...opencode,
      profile: { files: { "workspace/AGENTS.md": "# Sample" }, name: "sample" },
    };

    expect(decode(task).variants[0]).toEqual(task);
  });

  it("rejects the command harness without a run command", () => {
    expect(() =>
      decode({
        harness: "command",
        model: "openai/gpt-5.5",
        profile: { files: {}, name: "sample" },
        sandbox: "e2b",
      })
    ).toThrow();
  });

  it("rejects a run command on a harness that is not command", () => {
    expect(() =>
      decode({
        ...opencode,
        profile: { files: {}, name: "sample", run: "python agent.py" },
      })
    ).toThrow();
  });

  it("rejects the command harness with no profile at all", () => {
    expect(() =>
      decode({ harness: "command", model: "openai/gpt-5.5", sandbox: "e2b" })
    ).toThrow();
  });
});

describe("a profile's limits", () => {
  it("rejects a file past the per-file limit", () => {
    expect(() =>
      decode({
        ...opencode,
        profile: {
          files: {
            "workspace/big.md": "x".repeat(PROFILE_LIMITS.fileChars + 1),
          },
          name: "sample",
        },
      })
    ).toThrow();
  });

  it("rejects a name that is not a slug", () => {
    expect(() =>
      decode({ ...opencode, profile: { files: {}, name: "Sample Profile" } })
    ).toThrow();
  });
});

describe("a profile's env and variables", () => {
  it("refuses a name set in env and also declared as a variable", () => {
    expect(() =>
      Schema.decodeUnknownSync(HarnessProfile)({
        env: { SEARCH_API_KEY: "literal" },
        files: {},
        name: "sample",
        variables: ["SEARCH_API_KEY"],
      })
    ).toThrow("SEARCH_API_KEY is in both env and variables. Keep it in one.");
  });

  it("takes distinct names in env and variables", () => {
    const profile = {
      env: { LOG_LEVEL: "debug" },
      files: {},
      name: "sample",
      variables: ["SEARCH_API_KEY"],
    };

    expect(Schema.decodeUnknownSync(HarnessProfile)(profile)).toEqual(profile);
  });
});
