import { beforeAll, describe, expect, it } from "bun:test";
import { Database } from "@sphynx/db/client";
import { organization } from "@sphynx/db/schema/auth/organizations";
import { user } from "@sphynx/db/schema/auth/users";
import { credentialAuthAttempt } from "@sphynx/db/schema/credentials/auth-attempts";
import { environmentVariable } from "@sphynx/db/schema/credentials/environment-variables";
import { skipWithoutDatabase, testDatabase } from "@sphynx/db/test-database";
import { IdGeneratorLive } from "@sphynx/ids/layer";
import { Actor, OrganizationId, UserId } from "@sphynx/schema/domain/actor";
import { eq } from "drizzle-orm";
import {
  Clock,
  ConfigProvider,
  Duration,
  Effect,
  Layer,
  Redacted,
} from "effect";
import {
  CredentialCipher,
  CredentialCipherLive,
} from "../../src/credentials/cipher";
import { variablesRef } from "../../src/credentials/credential-ref";
import { DeviceAuth, DeviceAuthLive } from "../../src/credentials/device-auth";
import { CredentialResolver } from "../../src/credentials/resolver";
import { CredentialResolverLive } from "../../src/credentials/resolver-live";
import {
  Subscriptions,
  SubscriptionsLive,
} from "../../src/credentials/subscriptions";
import { systemActor } from "../../src/credentials/system-actor";
import {
  EnvironmentVariables,
  EnvironmentVariablesLive,
} from "../../src/environment/environment-variables";

const database = testDatabase({
  poolMax: 2,
  statementTimeout: Duration.seconds(10),
});
const dependencies = Layer.mergeAll(
  database,
  IdGeneratorLive,
  CredentialCipherLive
);
const subscriptions = SubscriptionsLive.pipe(Layer.provide(dependencies));
const TestLayer = Layer.mergeAll(
  CredentialCipherLive,
  subscriptions,
  EnvironmentVariablesLive.pipe(Layer.provide(dependencies)),
  CredentialResolverLive.pipe(Layer.provide(dependencies)),
  DeviceAuthLive.pipe(
    Layer.provide(subscriptions),
    Layer.provide(dependencies)
  ),
  database
);
const suffix = Date.now();
const organizationId = `org_environment_${suffix}`;
const userId = `user_environment_${suffix}`;
const otherUserId = `user_environment_other_${suffix}`;
const actorFor = (id: string) =>
  Actor.make({
    id: UserId.make(id),
    isUser: true,
    organizationId: OrganizationId.make(organizationId),
    permissions: [],
  });
const actor = actorFor(userId);
const otherActor = actorFor(otherUserId);

const run = <A, E>(
  effect: Effect.Effect<
    A,
    E,
    | CredentialCipher
    | CredentialResolver
    | Database
    | DeviceAuth
    | EnvironmentVariables
    | Subscriptions
  >
) =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(TestLayer),
      Effect.withConfigProvider(
        ConfigProvider.fromMap(
          new Map([["CREDENTIALS_ENCRYPTION_KEY", "live-test-key"]])
        )
      ),
      Effect.scoped
    ) as Effect.Effect<A, E>
  );

const valuesOf = (integrationId: string, who: Actor) =>
  Effect.flatMap(CredentialResolver, (resolver) =>
    resolver.resolve({ actor: who, integrationId })
  ).pipe(Effect.map((found) => Redacted.value(found)));

describe.skipIf(skipWithoutDatabase())("the environment", () => {
  beforeAll(() =>
    run(
      Effect.gen(function* () {
        const db = yield* Database;
        const now = new Date();
        yield* Effect.promise(() =>
          db.insert(organization).values({
            createdAt: now,
            id: organizationId,
            name: "Environment test",
            slug: `environment-${suffix}`,
          })
        );
        yield* Effect.promise(() =>
          db.insert(user).values([
            {
              createdAt: now,
              email: `environment-${suffix}@example.com`,
              emailVerified: true,
              id: userId,
              name: "Environment test",
              updatedAt: now,
            },
            {
              createdAt: now,
              email: `environment-other-${suffix}@example.com`,
              emailVerified: true,
              id: otherUserId,
              name: "Other environment test",
              updatedAt: now,
            },
          ])
        );
      })
    )
  );

  it("seals a value, shows only a preview, and replaces it on a second add", async () => {
    const result = await run(
      Effect.gen(function* () {
        const variables = yield* EnvironmentVariables;
        const [first] = yield* variables.add(actor, {
          scope: "organization",
          variables: [
            {
              name: "ANTHROPIC_API_KEY",
              secret: true,
              value: "sk-ant-first-0001",
            },
          ],
        });
        const [second] = yield* variables.add(actor, {
          scope: "organization",
          variables: [
            {
              name: "ANTHROPIC_API_KEY",
              secret: true,
              value: "sk-ant-second-0002",
            },
          ],
        });
        const db = yield* Database;
        const [row] = yield* Effect.promise(() =>
          db
            .select()
            .from(environmentVariable)
            .where(eq(environmentVariable.organizationId, organizationId))
        );
        const resolved = yield* valuesOf("claude", actor);
        return { first, resolved, row, second };
      })
    );

    expect(result.first?.preview).toBe("••••••••");
    expect(result.second?.id).toBe(result.first?.id);
    expect(result.second?.revision).toBe(2);
    expect(result.second?.preview).toBe("••••••••");
    expect(result.row?.sealedValue).not.toContain("sk-ant");
    expect(result.resolved).toMatchObject({
      authMethodId: "api-key",
      connectionId: variablesRef({ organizationId, userId }),
      integrationId: "claude",
      revision: 2,
      values: { apiKey: "sk-ant-second-0002" },
    });
  });

  it("keeps a plain value readable", async () => {
    const [shown] = await run(
      Effect.flatMap(EnvironmentVariables, (variables) =>
        variables.add(actor, {
          scope: "organization",
          variables: [
            { name: "APP_BASE_URL", secret: false, value: "staging.acme.dev" },
          ],
        })
      )
    );

    expect(shown?.preview).toBe("staging.acme.dev");
    expect(shown?.secret).toBe(false);
  });

  it("lets a personal value override the organization's for its owner only", async () => {
    const result = await run(
      Effect.gen(function* () {
        const variables = yield* EnvironmentVariables;
        yield* variables.add(actor, {
          scope: "organization",
          variables: [
            { name: "GEMINI_API_KEY", secret: true, value: "team-key-1" },
          ],
        });
        yield* variables.add(actor, {
          scope: "personal",
          variables: [
            { name: "GEMINI_API_KEY", secret: true, value: "mine-key-1" },
          ],
        });
        return {
          mine: (yield* valuesOf("gemini", actor)).values,
          system: (yield* valuesOf("gemini", systemActor(organizationId)))
            .values,
          theirs: (yield* valuesOf("gemini", otherActor)).values,
        };
      })
    );

    expect(result.mine).toEqual({ apiKey: "mine-key-1" });
    expect(result.theirs).toEqual({ apiKey: "team-key-1" });
    expect(result.system).toEqual({ apiKey: "team-key-1" });
  });

  it("names what to set when a tool has nothing", async () => {
    const failure = await run(Effect.flip(valuesOf("cursor", actor)));

    expect(failure.code).toBe("not-found");
    expect(failure.message).toBe(
      "Set CURSOR_API_KEY in Settings > Environment to run cursor"
    );
  });

  it("runs Codex on a ChatGPT subscription before an OpenAI key", async () => {
    const result = await run(
      Effect.gen(function* () {
        const variables = yield* EnvironmentVariables;
        yield* variables.add(actor, {
          scope: "organization",
          variables: [
            { name: "OPENAI_API_KEY", secret: true, value: "sk-openai-1" },
          ],
        });
        const byKey = yield* valuesOf("codex", actor);
        const subscription = yield* (yield* Subscriptions).addChatGpt(
          actor,
          '{"tokens":{"refresh_token":"r"}}',
          "organization"
        );
        const bySubscription = yield* valuesOf("codex", actor);
        const judge = yield* valuesOf("openai", actor);
        return { byKey, bySubscription, judge, subscription };
      })
    );

    expect(result.byKey.authMethodId).toBe("api-key");
    expect(result.byKey.values).toEqual({ apiKey: "sk-openai-1" });
    expect(result.subscription).toMatchObject({
      plan: "chatgpt",
      renews: true,
      scope: "organization",
    });
    expect(result.bySubscription.authMethodId).toBe("chatgpt");
    expect(result.bySubscription.connectionId).toBe(result.subscription.id);
    expect(result.judge.values).toEqual({ apiKey: "sk-openai-1" });
  });

  it("stores a pasted auth file as a subscription", async () => {
    const result = await run(
      Effect.gen(function* () {
        const added = yield* (yield* Subscriptions).add(actor, {
          authJson: '{"anthropic":{"type":"oauth"}}',
          plan: "opencode",
          scope: "personal",
        });
        const refused = yield* Effect.either(
          (yield* Subscriptions).add(actor, {
            authJson: "not json",
            plan: "pi",
            scope: "organization",
          })
        );
        return { added, refused, resolved: yield* valuesOf("opencode", actor) };
      })
    );

    expect(result.added).toMatchObject({ plan: "opencode", renews: false });
    expect(result.resolved.values).toEqual({
      authJson: '{"anthropic":{"type":"oauth"}}',
    });
    expect(result.refused._tag).toBe("Left");
  });

  it("hands a profile only the variables it names, from the bound owner", async () => {
    const result = await run(
      Effect.gen(function* () {
        yield* (yield* EnvironmentVariables).add(actor, {
          scope: "organization",
          variables: [
            { name: "SEARCH_API_KEY", secret: true, value: "exa-1" },
            { name: "APP_BASE_URL", secret: false, value: "staging.acme.dev" },
          ],
        });
        const resolver = yield* CredentialResolver;
        const found = yield* resolver.variables({
          credentialRef: variablesRef({ organizationId, userId }),
          names: ["SEARCH_API_KEY", "APP_BASE_URL"],
          organizationId,
        });
        const missing = yield* Effect.flip(
          resolver.variables({
            credentialRef: variablesRef({ organizationId, userId: null }),
            names: ["NEVER_SET"],
            organizationId,
          })
        );
        return { found: Redacted.value(found), missing };
      })
    );

    expect(result.found).toEqual({
      APP_BASE_URL: "staging.acme.dev",
      SEARCH_API_KEY: "exa-1",
    });
    expect(result.missing.message).toBe(
      "Set NEVER_SET in Settings > Environment"
    );
  });

  it("shows only the last four of a long secret", async () => {
    const [shown] = await run(
      Effect.flatMap(EnvironmentVariables, (variables) =>
        variables.add(actor, {
          scope: "organization",
          variables: [
            {
              name: "GROQ_API_KEY",
              secret: true,
              value: "gsk_live_0123456789abcdef",
            },
          ],
        })
      )
    );

    expect(shown?.preview).toBe("••••cdef");
  });

  it("hides a readable value on request, and never reveals a secret without a new value", async () => {
    const result = await run(
      Effect.gen(function* () {
        const variables = yield* EnvironmentVariables;
        const [plain] = yield* variables.add(actor, {
          scope: "organization",
          variables: [
            {
              name: "WEBHOOK_ADDRESS",
              secret: false,
              value: "https://hooks.example.com/services/abcdefghijklmnop",
            },
          ],
        });
        const hidden = yield* variables.update(actor, plain?.id ?? "", {
          secret: true,
        });
        const refused = yield* Effect.flip(
          variables.update(actor, plain?.id ?? "", { secret: false })
        );
        return { hidden, refused };
      })
    );

    expect(result.hidden).toMatchObject({ preview: "••••mnop", secret: true });
    expect(result.refused.message).toBe(
      "Give a new value to make a secret readable"
    );
  });

  it("binds a run to the caller's own variables whatever ref it names", async () => {
    const result = await run(
      Effect.gen(function* () {
        yield* (yield* EnvironmentVariables).add(actor, {
          scope: "personal",
          variables: [
            {
              name: "MOONSHOT_API_KEY",
              secret: true,
              value: "victim-personal",
            },
          ],
        });
        yield* (yield* EnvironmentVariables).add(actor, {
          scope: "organization",
          variables: [
            { name: "MOONSHOT_API_KEY", secret: true, value: "team-shared" },
          ],
        });
        const resolver = yield* CredentialResolver;
        const found = yield* resolver.resolve({
          actor: otherActor,
          credentialRef: variablesRef({ organizationId, userId }),
          integrationId: "moonshotai",
        });
        return Redacted.value(found);
      })
    );

    expect(result.values).toEqual({ apiKey: "team-shared" });
    expect(result.connectionId).toBe(
      variablesRef({ organizationId, userId: otherUserId })
    );
  });

  it("never hands a judge or sandbox key to a profile", async () => {
    const failure = await run(
      Effect.flatMap(CredentialResolver, (resolver) =>
        Effect.flip(
          resolver.variables({
            credentialRef: variablesRef({ organizationId, userId }),
            names: ["E2B_API_KEY"],
            organizationId,
          })
        )
      )
    );

    expect(failure.message).toBe("E2B_API_KEY never reaches a profile");
  });

  it("names the clash when a move would collide with a value already set", async () => {
    const failure = await run(
      Effect.gen(function* () {
        const variables = yield* EnvironmentVariables;
        yield* variables.add(actor, {
          scope: "organization",
          variables: [
            { name: "DEEPSEEK_API_KEY", secret: true, value: "team" },
          ],
        });
        const [mine] = yield* variables.add(actor, {
          scope: "personal",
          variables: [
            { name: "DEEPSEEK_API_KEY", secret: true, value: "mine" },
          ],
        });
        return yield* Effect.flip(
          variables.update(actor, mine?.id ?? "", { scope: "organization" })
        );
      })
    );

    expect(failure.message).toBe(
      "DEEPSEEK_API_KEY is already set for the organization"
    );
  });

  it("refuses a personal variable from an API key", async () => {
    const failure = await run(
      Effect.flip(
        Effect.flatMap(EnvironmentVariables, (variables) =>
          variables.add(systemActor(organizationId), {
            scope: "personal",
            variables: [{ name: "XAI_API_KEY", secret: true, value: "x" }],
          })
        )
      )
    );

    expect(failure.message).toBe("API keys cannot own personal variables");
  });

  it("expires device attempts using the Effect clock", async () => {
    const status = await run(
      Effect.gen(function* () {
        const cipher = yield* CredentialCipher;
        const db = yield* Database;
        const device = yield* DeviceAuth;
        const id = `credentialAuthAttempt_${suffix}`;
        const now = yield* Clock.currentTimeMillis;
        const sealedState = yield* cipher.seal(
          Redacted.make(JSON.stringify({ subscriptionId: null })),
          `${organizationId}\0${id}\0codex-device`
        );
        yield* Effect.promise(() =>
          db.insert(credentialAuthAttempt).values({
            authMethodId: "chatgpt",
            expiresAt: new Date(now - 1),
            id,
            integrationId: "codex",
            organizationId,
            sealedState,
            status: "pending",
            userId,
          })
        );
        return yield* device.status(actor, id);
      })
    );

    expect(status).toEqual({ subscriptionId: null, status: "expired" });
  });
});
