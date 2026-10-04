import { describe, expect, it } from "bun:test";
import { KNOWN_VARIABLES } from "@sphynx/schema/domain/known-variables";
import { MODEL_PROVIDERS } from "../../src/domain/model-providers";

describe("the variables simulated people run on", () => {
  it("are keys for providers a simulated person can talk to", () => {
    const providers = new Set(MODEL_PROVIDERS.map(({ id }) => id));

    expect(
      KNOWN_VARIABLES.filter(({ uses }) =>
        uses.some(({ kind }) => kind === "simulated")
      )
        .filter(({ uses }) =>
          uses.some(({ id, kind }) => kind === "judge" && !providers.has(id))
        )
        .map(({ name }) => name)
    ).toEqual([]);
    expect(
      KNOWN_VARIABLES.filter(({ uses }) =>
        uses.some(({ kind }) => kind === "simulated")
      ).map(({ name }) => name)
    ).toEqual([
      "ANTHROPIC_API_KEY",
      "OPENAI_API_KEY",
      "GEMINI_API_KEY",
      "XAI_API_KEY",
      "MOONSHOT_API_KEY",
      "DEEPSEEK_API_KEY",
      "GROQ_API_KEY",
      "OPENROUTER_API_KEY",
    ]);
  });
});
