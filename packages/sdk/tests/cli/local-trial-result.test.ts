import { describe, expect, it } from "bun:test";
import {
  HarnessUnavailable,
  PrepareFailed,
  TrialTimedOut,
} from "@sphynx/eval/domain/errors";
import { asEntries } from "@sphynx/eval/domain/journal-entries";
import { Cause } from "effect";
import {
  brokenBy,
  localCaseOf,
  reportRequest,
  verdictOf,
} from "../../src/cli/local-trial-result";
import { verdictLines } from "../../src/cli/transcript-verdict";
import { PLAIN, writerFor } from "../../src/cli/transcript-writer";
import { longTrial } from "../fixtures/long-trial";

const timedOut = brokenBy(
  Cause.fail(new TrialTimedOut({ timeoutMs: 1000 })),
  1400,
  []
);
const setupBroke = brokenBy(
  Cause.fail(
    new PrepareFailed({ name: "seeds-data", reason: "no database at :5432" })
  ),
  300,
  []
);
const agentFailed = brokenBy(
  Cause.fail(
    new HarnessUnavailable({
      harness: "command",
      reason: "The agent failed: Free tier users do not have access",
    })
  ),
  900,
  [
    {
      _tag: "Finished",
      at: 5,
      reason: "failed: Free tier users do not have access",
    },
  ]
);
const trial = { name: "retries", ordinal: 2, variant: "codex/luna" };

describe("a local trial that could not finish", () => {
  it("is timed out when it ran past its limit, with the limit as the reason", () => {
    expect(localCaseOf(timedOut, trial)).toEqual({
      durationMs: 1400,
      name: "retries",
      ordinal: 2,
      reason: "The agent ran past its time limit of 1s",
      status: "timed out",
      commands: 0,
      usage: null,
      variant: "codex/luna",
    });
    expect(verdictOf(timedOut)).toEqual({
      failure: "The agent ran past its time limit of 1s",
      status: "timed out",
      verifySteps: [],
      voidFields: [],
    });
    expect(verdictLines(verdictOf(timedOut), writerFor(PLAIN)).at(-1)).toBe(
      "  ○ timed out · The agent ran past its time limit of 1s"
    );
  });

  it("is void when its setup broke, and is reported with why", () => {
    expect(localCaseOf(setupBroke, trial).status).toBe("void");
    expect(reportRequest(setupBroke, 2, "run_1")).toEqual({
      payload: {
        events: [],
        failure: "no database at :5432",
        ordinal: 2,
        runId: "run_1",
        sandboxId: null,
        usage: null,
      },
    });
  });
});

describe("a local trial whose agent failed", () => {
  it("is reported with the agent's reason, never as an unexplained void", () => {
    expect(reportRequest(agentFailed, 1, "run_1").payload).toMatchObject({
      failure: "The agent failed: Free tier users do not have access",
    });
    expect(verdictLines(verdictOf(agentFailed), writerFor(PLAIN)).at(-1)).toBe(
      "  ○ void · The agent failed: Free tier users do not have access"
    );
  });
});

describe("a long local trial", () => {
  const { payload } = reportRequest(longTrial, 1, "run_1");

  it("is reported in one request the server takes", () => {
    expect(Buffer.byteLength(JSON.stringify(payload))).toBeLessThan(
      4 * 1024 * 1024
    );
  });

  it("keeps every command the journal shows, marked as cut", () => {
    const commands = payload.events.filter((event) => event._tag === "Command");

    expect(
      commands
        .flatMap(asEntries)
        .map((entry) =>
          entry._tag === "command"
            ? [entry.command, entry.output.length, entry.outputTruncated]
            : []
        )
    ).toEqual(
      commands.map((event) => [
        event._tag === "Command" ? event.command : "",
        4000,
        true,
      ])
    );
  });
});
