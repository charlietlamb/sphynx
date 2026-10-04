import { describe, expect, it } from "bun:test";
import type { ProfileContent } from "../../src/domain/harness-profile";
import { profileVersionOf } from "../../src/domain/profile-identity";

const profile: ProfileContent = {
  env: { SAMPLE_MODE: "strict", SAMPLE_REGION: "eu" },
  files: {
    "home/.config/opencode/opencode.json": '{"permission":{"bash":"allow"}}',
    "workspace/AGENTS.md": "# Sample\n",
  },
  install: null,
  run: null,
  systemPrompt: "You are the sample agent.\n",
  variables: null,
};

const HEX_32 = /^[0-9a-f]{32}$/;

const reversed = (record: Readonly<Record<string, string>>) =>
  Object.fromEntries(Object.entries(record).toReversed());

describe("a profile's version", () => {
  it("does not move with the order its maps were built in", () => {
    expect(
      profileVersionOf({
        ...profile,
        env: reversed(profile.env ?? {}),
        files: reversed(profile.files),
      })
    ).toBe(profileVersionOf(profile));
  });

  it("does not move with the order the variables were named in", () => {
    const named = { ...profile, variables: ["B_KEY", "A_KEY", "B_KEY"] };

    expect(
      profileVersionOf({ ...named, variables: ["A_KEY", "B_KEY", "B_KEY"] })
    ).toBe(profileVersionOf(named));
  });

  it("is thirty-two hex characters", () => {
    expect(profileVersionOf(profile)).toMatch(HEX_32);
  });

  const edits: readonly [string, ProfileContent][] = [
    ["a variable", { ...profile, variables: ["SEARCH_API_KEY"] }],
    [
      "a file's content",
      {
        ...profile,
        files: { ...profile.files, "workspace/AGENTS.md": "# Sample" },
      },
    ],
    [
      "a file's path",
      { ...profile, files: { "workspace/OTHER.md": "# Sample\n" } },
    ],
    [
      "an env value",
      { ...profile, env: { ...profile.env, SAMPLE_MODE: "loose" } },
    ],
    ["the env being dropped", { ...profile, env: null }],
    [
      "the system prompt",
      { ...profile, systemPrompt: "You are someone else.\n" },
    ],
    ["an install step", { ...profile, install: "pip install agent" }],
    ["a run step", { ...profile, run: "python agent.py" }],
  ];

  for (const [what, edited] of edits) {
    it(`moves when ${what} changes`, () => {
      expect(profileVersionOf(edited)).not.toBe(profileVersionOf(profile));
    });
  }
});
