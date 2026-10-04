import { describe, expect, it } from "bun:test";
import { knownMatches } from "../../../src/lib/settings/known-matches";

const namesFor = (query: string) =>
  knownMatches(query).map((known) => known.name);

describe("known matches", () => {
  it("lists prefix matches before inside matches", () => {
    expect(namesFor("ai")).toEqual([
      "AI_GATEWAY_API_KEY",
      "OPENAI_API_KEY",
      "XAI_API_KEY",
    ]);
    expect(namesFor("op")).toEqual([
      "OPENAI_API_KEY",
      "OPENROUTER_API_KEY",
      "ANTHROPIC_API_KEY",
      "DASHSCOPE_API_KEY",
    ]);
    expect(namesFor("MODAL_TOKEN_I")).toEqual(["MODAL_TOKEN_ID"]);
  });

  it("keeps a full name typed in another case so it can be picked", () => {
    expect(namesFor("anthropic_api_key")).toEqual(["ANTHROPIC_API_KEY"]);
  });
});
