import { Chunk, Effect, Option, Redacted, Stream } from "effect";
import { keepTagged } from "../adapters/keep-tagged";
import { CredentialResolver } from "../credentials/resolver";
import { systemActor } from "../credentials/system-actor";
import { describeError } from "../domain/failure";
import { readAnswer, sessionIdOf } from "../domain/journal";
import { Harnesses } from "../ports/harness";
import { SandboxProvider } from "../ports/sandbox";
import { HarnessVersions } from "../services/harness-versions";
import { JudgeFailed, type JudgeRequest } from "./model";
import { judgeEvidence, judgeInstructions } from "./prompt";

const WORKSPACE = "/tmp/sphynx-judge";

export const makeAgentJudge = Effect.gen(function* () {
  const harnesses = yield* Harnesses;
  const versions = yield* HarnessVersions;
  const sandboxes = yield* SandboxProvider;
  const credentials = yield* CredentialResolver;

  return (request: JudgeRequest) =>
    Effect.gen(function* () {
      if (request.judge.harness === undefined) {
        return yield* Effect.fail(
          new JudgeFailed({ message: "An agent judge needs a harness" })
        );
      }
      const { harness, model } = request.judge;
      const context = request.context;
      const credential =
        Redacted.value(context.harnessCredential).integrationId === harness
          ? context.harnessCredential
          : yield* credentials.resolve({
              actor: systemActor(context.organizationId),
              integrationId: harness,
            });
      const sandbox = yield* sandboxes.open({
        provider: context.provider,
        credentials: context.sandboxCredentials,
        autoStopMinutes: 5,
        workspace: WORKSPACE,
      });
      const driver = yield* harnesses.resolve(harness);
      const version = yield* versions.version(harness);
      const env = yield* driver.prepare({
        credential,
        home: sandbox.home,
        profile: Option.none(),
        sandbox,
        version,
      });
      const prompt = `${judgeInstructions(request)}\n\nEvidence:\n${judgeEvidence(request)}`;
      if (request.onRequest) {
        yield* request.onRequest({
          model,
          harness,
          harnessVersion: version,
          prompt,
        });
      }
      const session = yield* driver.run({
        env,
        harness,
        resume: Option.none(),
        harnessVersion: version,
        model,
        profile: Option.none(),
        prompt,
        sandbox,
        systemPromptPath: Option.none(),
        workspace: WORKSPACE,
      });
      const events = Chunk.toReadonlyArray(
        yield* Stream.runCollect(session.events)
      );
      const toolCalls = events.flatMap((event) => {
        if (event._tag === "Command") {
          return ["command"];
        }
        if (event._tag === "ToolCall") {
          return [event.name];
        }
        return [];
      });
      const usage = yield* session.usage;
      return {
        text: readAnswer(events),
        model,
        harnessVersion: version,
        sessionId: sessionIdOf(events) ?? undefined,
        usage: Option.getOrUndefined(usage),
        toolCalls,
      };
    }).pipe(
      Effect.scoped,
      keepTagged(
        "JudgeFailed",
        (error) =>
          new JudgeFailed({
            message: `The agent judge could not complete: ${describeError(error)}`,
          })
      ),
      Effect.withSpan("AgentJudge.complete")
    );
});
