import type { HarnessEvent } from "@sphynx/schema/domain/harness-event";
import { Effect, Option, Ref, Stream } from "effect";
import type { HarnessSessionShape, RunHarness } from "../../ports/harness";
import { runCommandForOutcome } from "../sandbox/run-command";
import { decodeCommandLine, finishedOnExit } from "./command-events";
import { tracePath } from "./command-line";
import { traceToEvents, withoutReported } from "./command-recorder";
import { type HarnessOutput, harnessLines, shellQuote } from "./process";
import { decoding } from "./session";

const TRACE_TIMEOUT_MS = 60_000;

const traceFold = (
  request: RunHarness,
  reported: Ref.Ref<readonly HarnessEvent[]>
) =>
  Stream.unwrap(
    Effect.gen(function* () {
      const trace = shellQuote(tracePath(request.sandbox));
      const outcome = yield* runCommandForOutcome(
        request.sandbox,
        `cat ${trace} 2>/dev/null && rm -f ${trace} || true`,
        { timeoutMs: TRACE_TIMEOUT_MS }
      ).pipe(Effect.option);

      if (Option.isNone(outcome)) {
        return Stream.empty;
      }

      return Stream.fromIterable(
        withoutReported(
          traceToEvents(outcome.value.stdout),
          yield* Ref.get(reported)
        )
      );
    })
  );

export const commandSession = (request: RunHarness, command: string) =>
  Effect.gen(function* () {
    const session = yield* decoding(request, decodeCommandLine, false);
    const finished = yield* Ref.make(false);
    const reported = yield* Ref.make<readonly HarnessEvent[]>([]);

    const journalled = (output: HarnessOutput) =>
      output._tag === "exit"
        ? Ref.get(finished).pipe(
            Effect.map((seen) => Option.toArray(finishedOnExit(output, seen)))
          )
        : session
            .step(output)
            .pipe(
              Effect.tap((events) =>
                Effect.all([
                  Ref.update(
                    finished,
                    (seen) =>
                      seen || events.some((event) => event._tag === "Finished")
                  ),
                  Ref.update(reported, (seen) => [...seen, ...events]),
                ])
              )
            );

    return {
      events: harnessLines(
        request.harness,
        request.sandbox,
        command,
        request.env,
        { exit: "report", timeout: request.timeout }
      ).pipe(
        Stream.mapConcatEffect(journalled),
        Stream.concat(traceFold(request, reported)),
        Stream.concat(Stream.drain(Stream.fromEffect(session.settled)))
      ),
      harness: request.harness,
      usage: session.usage,
      version: request.harnessVersion,
    } satisfies HarnessSessionShape;
  });
