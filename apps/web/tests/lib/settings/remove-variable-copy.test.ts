import { describe, expect, it } from "bun:test";
import { removeVariableCopy } from "../../../src/lib/settings/remove-variable-copy";

const describedFor = (
  name: string,
  subscriptions: readonly {
    readonly plan: "chatgpt" | "opencode" | "pi";
    readonly status: "active" | "invalid";
  }[] = []
) =>
  removeVariableCopy({ name, scope: "organization" }, [], subscriptions)
    .description;

describe("remove variable copy", () => {
  it("names what stops running for a known key", () => {
    expect(describedFor("ANTHROPIC_API_KEY")).toBe(
      "Claude Code, Anthropic judges and simulated people stop running until you add it again. This cannot be undone."
    );
  });

  it("agrees with a single harness", () => {
    expect(describedFor("CURSOR_API_KEY")).toBe(
      "Cursor stops running until you add it again. This cannot be undone."
    );
  });

  it("keeps Codex on an active ChatGPT plan", () => {
    expect(
      describedFor("OPENAI_API_KEY", [{ plan: "chatgpt", status: "active" }])
    ).toBe(
      "OpenAI judges and simulated people stop running until you add it again. Codex keeps running on your ChatGPT plan. This cannot be undone."
    );
  });

  it("does not count on a ChatGPT plan that needs reconnecting", () => {
    expect(
      describedFor("OPENAI_API_KEY", [{ plan: "chatgpt", status: "invalid" }])
    ).toBe(
      "Codex, OpenAI judges and simulated people stop running until you add it again. This cannot be undone."
    );
  });

  it("moves sandboxes to the hosted account", () => {
    expect(describedFor("E2B_API_KEY")).toBe(
      "E2B sandboxes move to Sphynx's hosted account. This cannot be undone."
    );
  });

  it("says an optional setting leaves its tool running", () => {
    expect(describedFor("QWEN_BASE_URL")).toBe(
      "Qwen Code keeps running without it. This cannot be undone."
    );
    expect(describedFor("CLOUDFLARE_SANDBOX_URL")).toBe(
      "Cloudflare sandboxes keep running without it. This cannot be undone."
    );
  });

  it("speaks of profiles for a name it does not know", () => {
    expect(describedFor("SEARCH_API_KEY")).toBe(
      "Profiles that name it stop running until you add it again. This cannot be undone."
    );
  });

  it("falls back to the organization value for a personal override", () => {
    const mine = { name: "OPENAI_API_KEY", scope: "personal" as const };
    const copy = removeVariableCopy(
      mine,
      [mine, { name: "OPENAI_API_KEY", scope: "organization" }],
      []
    );

    expect(copy).toEqual({
      confirmLabel: "Use the organization value",
      description:
        "Your runs go back to the organization value. Nothing stops.",
      destructive: false,
      title: "Remove your OPENAI_API_KEY?",
    });
  });
});
