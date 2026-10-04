import { describe, expect, it } from "bun:test";
import { knownVariable } from "@sphynx/schema/domain/known-variables";
import { VARIABLE_CREDENTIALS } from "../../src/environment/variable-credentials";

describe("the variables a credential reads", () => {
  it("are optional exactly where the catalog says a tool runs without them", () => {
    const fields = Object.values(VARIABLE_CREDENTIALS).flatMap(
      ({ fields: read }) => read
    );

    expect(
      fields
        .filter(
          ({ optional, variable }) =>
            (optional === true) !== knownVariable(variable)?.optional
        )
        .map(({ variable }) => variable)
    ).toEqual([]);
    expect(
      fields
        .filter(({ optional }) => optional === true)
        .map(({ variable }) => variable)
        .toSorted()
    ).toEqual([
      "CLOUDFLARE_ACCOUNT_ID",
      "CLOUDFLARE_SANDBOX_API_KEY",
      "CLOUDFLARE_SANDBOX_URL",
      "QWEN_BASE_URL",
    ]);
  });
});
