import { describe, expect, it } from "bun:test";
import { Effect, Redacted } from "effect";
import { CredentialError } from "../../src/credentials/errors";
import type {
  CredentialResolverShape,
  ResolveCredential,
} from "../../src/credentials/resolver";
import {
  type BindVariant,
  bindCredentials,
  KEYLESS_HARNESSES,
  unkeyed,
} from "../../src/credentials/variants";
import { actorOf } from "../fixtures/eval-stack";

const actor = actorOf("organization", true);

const notFound = () =>
  Effect.fail(new CredentialError({ code: "not-found", message: "not found" }));

const resolved = (input: ResolveCredential, revision: number) =>
  Effect.succeed(
    Redacted.make({
      authMethodId: "api-key",
      connectionId: input.credentialRef ?? `default-${input.integrationId}`,
      integrationId: input.integrationId,
      revision,
      values: { apiKey: "secret" },
    })
  );

const resolverOf = (
  resolve: CredentialResolverShape["resolve"]
): CredentialResolverShape => ({
  persist: () => Effect.void,
  resolve,
  resolveBound: notFound,
  variables: notFound,
});

const connected = (integrations: readonly string[], revision = 3) =>
  resolverOf((input) =>
    integrations.includes(input.integrationId)
      ? resolved(input, revision)
      : notFound()
  );

const variant: BindVariant = { harness: "codex", sandbox: "daytona" };

const bind = (
  resolver: CredentialResolverShape,
  variants: readonly BindVariant[]
) => Effect.runPromise(bindCredentials(resolver, actor, variants));

const refusal = (
  resolver: CredentialResolverShape,
  variants: readonly BindVariant[]
) =>
  Effect.runPromise(
    bindCredentials(resolver, actor, variants).pipe(Effect.flip)
  );

describe("binding credentials to variants", () => {
  it("records the default harness and sandbox connections with their revisions", async () => {
    const [bound] = await bind(connected(["codex", "daytona"]), [variant]);

    expect(bound).toEqual({
      harnessCredentialRef: "default-codex",
      harnessCredentialRevision: 3,
      sandboxCredentialRef: "default-daytona",
      sandboxCredentialRevision: 3,
    });
  });

  it("follows explicit bindings", async () => {
    const [bound] = await bind(connected(["codex", "daytona"]), [
      {
        ...variant,
        credentials: {
          harnessRef: "harness",
          sandboxRef: "sandbox",
        },
      },
    ]);

    expect(bound?.harnessCredentialRef).toBe("harness");
    expect(bound?.sandboxCredentialRef).toBe("sandbox");
  });

  it("binds each variant on its own", async () => {
    const bound = await bind(connected(["codex", "claude", "e2b"]), [
      variant,
      { harness: "claude", sandbox: "e2b" },
    ]);

    expect(bound.map((entry) => entry.harnessCredentialRef)).toEqual([
      "default-codex",
      "default-claude",
    ]);
    expect(bound.map((entry) => entry.sandboxCredentialRef)).toEqual([
      null,
      "default-e2b",
    ]);
  });

  it("refuses a keyed harness with no credential at all", async () => {
    const failure = await refusal(connected([]), [
      { harness: "claude", sandbox: "daytona" },
    ]);

    expect(failure.code).toBe("not-found");
    expect(failure.message).toBe("not found");
  });

  it("binds a keyless command harness to the starter's variables", async () => {
    const [bound] = await bind(connected([]), [
      { harness: "command", sandbox: "daytona" },
    ]);

    expect(bound).toEqual({
      harnessCredentialRef: "variables:user_organization",
      harnessCredentialRevision: null,
      sandboxCredentialRef: null,
      sandboxCredentialRevision: null,
    });
  });

  it("stores no binding for a local credential that has no stored revision", async () => {
    const [bound] = await bind(connected(["codex", "daytona"], 0), [variant]);

    expect(bound?.harnessCredentialRef).toBeNull();
    expect(bound?.harnessCredentialRevision).toBeNull();
    expect(bound?.sandboxCredentialRef).toBeNull();
  });

  it("does not hide an explicit harness binding that is gone", async () => {
    const failure = await refusal(connected([]), [
      { ...variant, credentials: { harnessRef: "removed" } },
    ]);

    expect(failure.code).toBe("not-found");
  });

  it("does not hide an explicit sandbox binding that is gone", async () => {
    const failure = await refusal(connected(["codex"]), [
      { ...variant, credentials: { sandboxRef: "removed" } },
    ]);

    expect(failure.code).toBe("not-found");
  });

  it.each([
    "codex",
    "daytona",
  ])("reports a %s store failure instead of treating it as missing", async (integration) => {
    const down = resolverOf((input) =>
      input.integrationId === integration
        ? Effect.fail(
            new CredentialError({ code: "internal", message: "store down" })
          )
        : resolved(input, 1)
    );
    const failure = await refusal(down, [variant]);

    expect(failure.code).toBe("internal");
    expect(failure.message).toBe("store down");
  });
});

describe("the keyless credential", () => {
  it("covers only the command harness", () => {
    expect([...KEYLESS_HARNESSES]).toEqual(["command"]);
  });

  it("carries no values and no stored revision", () => {
    expect(Redacted.value(unkeyed())).toEqual({
      authMethodId: "none",
      connectionId: "none",
      integrationId: "none",
      revision: 0,
      values: {},
    });
  });
});
