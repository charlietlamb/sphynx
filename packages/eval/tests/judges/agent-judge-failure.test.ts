import { expect, test } from "bun:test";
import { EvalJudge } from "@sphynx/schema/domain/eval-judges";
import { Effect, Layer, Redacted, Schema } from "effect";
import { credentialResolverFrom } from "../../src/credentials/env-resolver";
import { makeAgentJudge } from "../../src/judges/agent";
import { Harnesses } from "../../src/ports/harness";
import { SandboxProvider } from "../../src/ports/sandbox";
import { HarnessVersions } from "../../src/services/harness-versions";

const unreachable = new Proxy(
  {},
  {
    get: () => () => Effect.die("a judge without a credential went further"),
  }
);

const keyless = Layer.mergeAll(
  credentialResolverFrom({
    credentials: new Map([["command", { authMethodId: "none", values: {} }]]),
    variables: {},
  }),
  Layer.succeed(Harnesses, unreachable as never),
  Layer.succeed(HarnessVersions, unreachable as never),
  Layer.succeed(SandboxProvider, unreachable as never)
);

test("an agent judge without a credential names the one it needs", async () => {
  const judge = Schema.decodeUnknownSync(EvalJudge)({
    choices: { correct: 1, incorrect: 0 },
    harness: "codex",
    kind: "judge",
    model: "gpt-5.6-sol",
    name: "tone",
    prompt: "Is the tone right?",
  });

  const failed = await Effect.runPromise(
    makeAgentJudge.pipe(
      Effect.flatMap((complete) =>
        complete({
          context: {
            harnessCredential: Redacted.make({
              authMethodId: "none",
              connectionId: "local",
              integrationId: "command",
              revision: 0,
              values: {},
            }),
            organizationId: "local",
            provider: "local",
          },
          events: [],
          input: "Write a changelog",
          judge,
          output: "Changelog",
        })
      ),
      Effect.flip,
      Effect.provide(keyless)
    )
  );

  expect(failed.message).toBe(
    "The agent judge could not complete: this run holds credentials for command, not one for codex. Set OPENAI_API_KEY."
  );
});
