import { describe, expect, it } from "bun:test";
import { Either, Schema } from "effect";
import { secretByDefault } from "../../src/domain/environment";
import { HarnessProfile } from "../../src/domain/harness-profile";

describe("whether a value starts out secret", () => {
  it.each([
    ["SLACK_WEBHOOK_URL", "https://hooks.slack.com/services/T1/B2/abc", true],
    ["API_URL", "https://api.example.com/v1?key=1", true],
    ["PIN", "1234", true],
    ["MODE", "staging", true],
    ["APP_BASE_URL", "staging.acme.dev", false],
    ["API_BASE", "http://localhost:3005", false],
    ["DEPLOY_API_TOKEN", "https://cdn.example.com", true],
  ])("%s=%s is secret: %p", (name, value, secret) => {
    expect(secretByDefault(name, value, undefined)).toBe(secret);
  });

  it("follows the known variable over the name and the value", () => {
    expect(
      secretByDefault("QWEN_BASE_URL", "not an address", { secret: false })
    ).toBe(false);
    expect(
      secretByDefault("APP_BASE_URL", "staging.acme.dev", { secret: true })
    ).toBe(true);
  });
});

describe("the variables a profile names", () => {
  const decode = Schema.decodeUnknownEither(HarnessProfile);
  const profile = (variables: readonly string[]) => ({
    files: {},
    name: "a-profile",
    run: "true",
    variables,
  });

  it("refuses a key only a judge or sandbox uses", () => {
    expect(Either.isLeft(decode(profile(["E2B_API_KEY"])))).toBe(true);
    expect(Either.isLeft(decode(profile(["GROQ_API_KEY"])))).toBe(true);
  });

  it("accepts a harness key and a name of its own", () => {
    expect(
      Either.isRight(decode(profile(["AI_GATEWAY_API_KEY", "SEARCH_API_KEY"])))
    ).toBe(true);
  });
});
