import { describe, expect, it } from "bun:test";
import { usedBy } from "../../../src/lib/settings/variable-uses";

describe("used by", () => {
  it("lists the harness, the judges and the simulated people a known key runs", () => {
    expect(usedBy("ANTHROPIC_API_KEY")).toEqual([
      { id: "claude", kind: "harness", label: "Claude Code" },
      { id: "anthropic", kind: "judge", label: "Judges" },
      { id: "people", kind: "simulated", label: "Simulated people" },
    ]);
  });

  it("lists the sandbox a sandbox key runs", () => {
    expect(usedBy("MODAL_TOKEN_ID")).toEqual([
      { id: "modal", kind: "sandbox", label: "Modal" },
    ]);
  });

  it("lists judges and simulated people for a provider only key", () => {
    expect(usedBy("XAI_API_KEY")).toEqual([
      { id: "xai", kind: "judge", label: "Judges" },
      { id: "people", kind: "simulated", label: "Simulated people" },
    ]);
  });

  it("says your code for a name it does not know", () => {
    expect(usedBy("SEARCH_API_KEY")).toEqual([
      { kind: "code", label: "Your code" },
    ]);
  });
});
