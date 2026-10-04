import { describe, expect, it } from "bun:test";
import { removeVariableCopy } from "../../../src/lib/settings/remove-variable-copy";

describe("remove variable copy", () => {
  it("names what stops running for a known key", () => {
    expect(
      removeVariableCopy(
        { name: "ANTHROPIC_API_KEY", scope: "organization" },
        []
      ).description
    ).toBe(
      "Claude Code, Anthropic judges and simulated people stop running until you add it again. This cannot be undone."
    );
  });

  it("speaks of suites for a name it does not know", () => {
    expect(
      removeVariableCopy({ name: "SEARCH_API_KEY", scope: "organization" }, [])
        .description
    ).toBe("Suites that name it stop getting it. This cannot be undone.");
  });

  it("falls back to the organization value for a personal override", () => {
    const mine = { name: "OPENAI_API_KEY", scope: "personal" as const };
    const copy = removeVariableCopy(mine, [
      mine,
      { name: "OPENAI_API_KEY", scope: "organization" },
    ]);

    expect(copy.title).toBe("Remove your OPENAI_API_KEY?");
    expect(copy.destructive).toBe(false);
  });
});
