import { describe, expect, it } from "bun:test";
import { ConfigProvider, Effect, Either, Option, Redacted } from "effect";
import {
  CredentialResolverFromEnv,
  credentialResolverFrom,
} from "../../src/credentials/env-resolver";
import { modelAccessFor } from "../../src/credentials/model-key";
import { CredentialResolver } from "../../src/credentials/resolver";
import { systemActor } from "../../src/credentials/system-actor";

const leased = credentialResolverFrom({
  credentials: new Map([
    ["codex", { authMethodId: "api-key", values: { apiKey: "sk-lent" } }],
    ["claude", { authMethodId: "api-key", values: { apiKey: "sk-ant-lent" } }],
  ]),
  variables: { SEARCH_API_KEY: "exa-lent" },
});

const resolving = (integrationId: string) =>
  Effect.runPromise(
    Effect.flatMap(CredentialResolver, (credentials) =>
      credentials.resolve({ actor: systemActor("org"), integrationId })
    ).pipe(
      Effect.map((found) => {
        const { authMethodId, values } = Redacted.value(found);
        return { authMethodId, values };
      }),
      Effect.mapError((error) => error.message),
      Effect.either,
      Effect.provide(leased)
    )
  );

describe("credentials lent to a local run", () => {
  it("answers each harness the run leased, with its auth method", async () => {
    expect([await resolving("codex"), await resolving("claude")]).toEqual([
      Either.right({ authMethodId: "api-key", values: { apiKey: "sk-lent" } }),
      Either.right({
        authMethodId: "api-key",
        values: { apiKey: "sk-ant-lent" },
      }),
    ]);
  });

  it("answers a harness that needs no key with no values, as a hosted run does", async () => {
    expect(await resolving("command")).toEqual(
      Either.right({ authMethodId: "none", values: {} })
    );
  });

  it("names only the variables a missing harness needs", async () => {
    expect(await resolving("qwen")).toEqual(
      Either.left(
        "this run holds credentials for codex, claude, not one for qwen. Set DASHSCOPE_API_KEY in Settings > Environment."
      )
    );
  });

  it("refuses any integration it holds no lease for", async () => {
    expect(await resolving("opencode")).toEqual(
      Either.left(
        "this run holds credentials for codex, claude, not one for opencode."
      )
    );
  });

  it("hands a profile the variables it leased and names the missing ones", async () => {
    const named = await Effect.runPromise(
      Effect.flatMap(CredentialResolver, (credentials) =>
        Effect.all([
          credentials.variables({
            credentialRef: "local",
            names: ["SEARCH_API_KEY"],
            organizationId: "local",
          }),
          Effect.flip(
            credentials.variables({
              credentialRef: "local",
              names: ["NEVER_SET"],
              organizationId: "local",
            })
          ),
        ])
      ).pipe(Effect.provide(leased))
    );

    expect(Redacted.value(named[0])).toEqual({ SEARCH_API_KEY: "exa-lent" });
    expect(named[1].message).toBe("Set NEVER_SET to run this profile");
  });

  it("is never used as a model key for the simulated user", async () => {
    const access = await Effect.runPromise(
      Effect.flatMap(CredentialResolver, (credentials) =>
        modelAccessFor(credentials, "org", "openai")
      ).pipe(
        Effect.provide(leased),
        Effect.withConfigProvider(ConfigProvider.fromMap(new Map()))
      )
    );

    expect(Option.isNone(access)).toBe(true);
  });
});

describe("a keyless local run", () => {
  it("reads the same known names from the shell", async () => {
    const previous = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "sk-ant-shell";
    const found = await Effect.runPromise(
      Effect.flatMap(CredentialResolver, (credentials) =>
        credentials.resolve({
          actor: systemActor("org"),
          integrationId: "claude",
        })
      ).pipe(Effect.provide(CredentialResolverFromEnv))
    ).finally(() => {
      if (previous === undefined) {
        delete process.env.ANTHROPIC_API_KEY;
      } else {
        process.env.ANTHROPIC_API_KEY = previous;
      }
    });

    expect(Redacted.value(found)).toMatchObject({
      authMethodId: "api-key",
      values: { apiKey: "sk-ant-shell" },
    });
  });
});
