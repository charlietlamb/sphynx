import type {
  HarnessEvent,
  HarnessUsage,
} from "@sphynx/schema/domain/harness-event";
import { Option, Schema } from "effect";
import { CommandLine, type CommandUsageLine } from "../../domain/command-line";
import type { HarnessExit } from "./process";
import type { DecodedOutput } from "./session";

const decodeLine = Schema.decodeUnknownOption(Schema.parseJson(CommandLine));

const FAILED = "failed:";

const agentFailure = (reason: string) =>
  `The agent failed: ${reason.slice(FAILED.length).trim()}`;

const usageOf = (line: CommandUsageLine): HarnessUsage => ({
  cacheReadTokens: line.cacheReadTokens ?? 0,
  cacheWriteTokens: line.cacheWriteTokens ?? 0,
  inputTokens: line.inputTokens,
  outputTokens: line.outputTokens,
  totalTokens: line.totalTokens ?? line.inputTokens + line.outputTokens,
});

const outputOf = (decoded: CommandLine, at: number): DecodedOutput => {
  if (decoded._tag === "Usage") {
    return { usage: usageOf(decoded), usageIsCumulative: false };
  }

  if (decoded._tag === "Started") {
    return { model: decoded.model, sessionId: decoded.sessionId };
  }

  const event = { ...decoded, at: decoded.at ?? at };

  return event._tag === "Finished" && event.reason.startsWith(FAILED)
    ? { events: [event], failure: agentFailure(event.reason) }
    : { events: [event] };
};

export const decodeCommandLine = (line: string, at: number): DecodedOutput =>
  decodeLine(line).pipe(
    Option.match({
      onNone: (): DecodedOutput => ({}),
      onSome: (decoded) => outputOf(decoded, at),
    })
  );

export const finishedOnExit = (
  exit: HarnessExit,
  finishedSeen: boolean
): Option.Option<HarnessEvent> =>
  finishedSeen
    ? Option.none()
    : Option.some({
        _tag: "Finished",
        at: exit.at,
        reason: `exit ${exit.exitCode}`,
      });
