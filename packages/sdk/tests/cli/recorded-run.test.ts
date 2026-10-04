import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { resolve } from "node:path";
import { HttpApiDecodeError } from "@effect/platform/HttpApiError";
import { NodeContext } from "@effect/platform-node";
import type { EvalCosts } from "@sphynx/schema/domain/eval-costs";
import { StartBatchRequest } from "@sphynx/schema/domain/eval-definition";
import { EvalBatch } from "@sphynx/schema/domain/evals";
import { TrialOutcome } from "@sphynx/schema/domain/trial";
import {
  Cause,
  ConfigProvider,
  Effect,
  Either,
  Exit,
  Fiber,
  Option,
  Schema,
} from "effect";
import { runRecorded } from "../../src/cli/recorded-run";
import { runSuitesLocally } from "../../src/cli/suite-local";
import { ClientLayer } from "../../src/client/config";
import { asSphynxError } from "../../src/client/errors";
import { compileFixture } from "../fixtures/compile-eval";
import { createBatch, createRun } from "../fixtures/eval-run";

const requestWith = (
  run: string,
  timeoutMs: number | null = null,
  variables: readonly string[] = []
) =>
  Schema.decodeUnknownSync(StartBatchRequest)({
    cases: [{ id: "fixture", timeoutMs, verify: "test -f done.txt" }],
    suite: { id: "flaky-network", prompt: "write done.txt" },
    trials: 1,
    variants: [
      {
        harness: "command",
        model: "none",
        profile: {
          files: {},
          name: "writes-done",
          run,
          ...(variables.length === 0 ? {} : { variables }),
        },
      },
    ],
  });

const START_KEY = /^[0-9a-f]{32}$/;

const priced = (component: "model" | "user" | "judge", usd: number) => ({
  classification: "estimate" as const,
  component,
  detail: {},
  explanation: "",
  source: "aggregate",
  usd,
});

const PRICED: EvalCosts = {
  allocatedUsd: 0,
  components: [
    priced("model", 0.42),
    priced("judge", 0.01),
    priced("user", 0.03),
  ],
  estimatedEquivalentUsd: 0.46,
  incomplete: false,
  knownActualUsd: 0,
};

const CLOSED =
  "Sphynx closed this run after it stopped hearing from this machine, so it no longer takes results. Run the eval again.";

const UNSET = "Set SEARCH_API_KEY in Settings > Environment";

const GATEWAY_PAGE =
  "<html><body><h1>503 Service Temporarily Unavailable</h1></body></html>";

interface Api {
  readonly calls: Map<string, number>;
  readonly finished: string[];
  readonly journals: number[];
  readonly leasedNames: string[][];
  readonly reported: {
    readonly failure?: string;
    readonly ordinal: number;
    readonly runId: string;
    readonly status?: string;
  }[];
  readonly started: Promise<void>;
  readonly startKeys: (string | null)[];
  readonly startsCheckingIn: unknown[];
  readonly url: string;
}

let stop: (() => void) | undefined;

afterEach(() => {
  stop?.();
  stop = undefined;
});

const OldReportedTrial = Schema.Struct({
  events: Schema.Array(Schema.Unknown),
  ordinal: Schema.Int,
  outcome: TrialOutcome,
  runId: Schema.String,
});

const refusedByOldServer = (body: unknown) =>
  Either.match(Schema.decodeUnknownEither(OldReportedTrial)(body), {
    onLeft: (error) =>
      Schema.encodeSync(HttpApiDecodeError)(
        Effect.runSync(HttpApiDecodeError.fromParseError(error))
      ),
    onRight: () => null,
  });

const fakeApi = (
  request: StartBatchRequest,
  failures: Readonly<Record<string, readonly number[]>>,
  knowsBeat = true,
  version: "current" | "before-broken-reports" = "current",
  maxRequestBodySize = 4 * 1024 * 1024
): Api => {
  const calls = new Map<string, number>();
  const finished: string[] = [];
  const journals: number[] = [];
  const leasedNames: string[][] = [];
  const reported: { failure?: string; ordinal: number; runId: string }[] = [];
  const started = Promise.withResolvers<void>();
  const startKeys: (string | null)[] = [];
  const startsCheckingIn: unknown[] = [];
  const variant = request.variants[0];
  const caseId = request.cases[0]?.id ?? "fixture";
  const running = createBatch({
    finishedAt: null,
    id: "batch_1",
    local: true,
    runs: [
      createRun({
        case: { id: caseId, name: caseId },
        variant: {
          ...createRun().variant,
          harness: variant?.harness ?? "command",
          id: "variant_1",
          model: variant?.model ?? "none",
          profile: variant?.profile?.name ?? null,
          sandbox: variant?.sandbox ?? "local",
        },
      }),
    ],
    status: "running",
  });
  const batch = Schema.encodeSync(EvalBatch)(running);
  const finishedBatch = Schema.encodeSync(EvalBatch)({
    ...running,
    costs: PRICED,
    status: "finished",
  });

  const server = Bun.serve({
    maxRequestBodySize,
    port: 0,
    fetch: async (incoming) => {
      const path = new URL(incoming.url).pathname.replace("/v1/", "");
      const attempt = (calls.get(path) ?? 0) + 1;
      calls.set(path, attempt);
      if (path === "runner.start") {
        startKeys.push(incoming.headers.get("idempotency-key"));
      }
      const failure = failures[path]?.[attempt - 1];
      if (failure === 404) {
        return Response.json(
          { _tag: "NotFound", message: UNSET },
          { status: 404 }
        );
      }
      if (failure === 409) {
        return Response.json(
          { _tag: "Conflict", message: CLOSED },
          { status: 409 }
        );
      }
      if (failure !== undefined) {
        return new Response(GATEWAY_PAGE, {
          headers: { "content-type": "text/html" },
          status: failure,
        });
      }
      const body = (
        incoming.method === "POST" ? await incoming.json() : {}
      ) as Record<string, unknown>;
      switch (path) {
        case "runner.start":
          startsCheckingIn.push(body.checksIn);
          started.resolve();
          return Response.json({
            id: "batch_1",
            runs: [{ caseId, id: "run_1", variantId: "variant_1" }],
          });
        case "auth.whoami":
          return Response.json({
            credential: { kind: "apiKey", name: "ci", start: "anp_test" },
            organization: { id: "org_1", name: "Acme", slug: "acme" },
            permissions: ["evals:write"],
          });
        case "evals.batches.get":
          return Response.json(batch);
        case "runner.report": {
          const refused =
            version === "current" ? null : refusedByOldServer(body);
          if (refused !== null) {
            return Response.json(refused, { status: 400 });
          }
          journals.push((body.events as unknown[]).length);
          reported.push({
            ...(typeof body.failure === "string"
              ? { failure: body.failure }
              : {}),
            ordinal: body.ordinal as number,
            runId: body.runId as string,
            ...(version === "current"
              ? {}
              : { status: (body.outcome as { status: string }).status }),
          });
          return new Response(null, { status: 204 });
        }
        case "runner.leaseVariables": {
          const names = body.names as string[];
          leasedNames.push(names);
          return Response.json({
            expiresAt: "2030-01-01T00:00:00.000Z",
            values: Object.fromEntries(
              names.map((name) => [name, `leased-${name}`])
            ),
          });
        }
        case "runner.beat":
          return new Response(null, { status: knowsBeat ? 204 : 404 });
        case "runner.finish":
          finished.push(body.id as string);
          return Response.json(finishedBatch);
        default:
          return Response.json({ _tag: "NotFound" }, { status: 404 });
      }
    },
  });
  stop = () => server.stop(true);

  return {
    calls,
    finished,
    journals,
    leasedNames,
    reported,
    started: started.promise,
    startKeys,
    startsCheckingIn,
    url: server.url.href.slice(0, -1),
  };
};

const recorded = (api: Api, request: StartBatchRequest) =>
  runRecorded("flaky-network", request, false).pipe(
    Effect.provide(ClientLayer),
    Effect.provide(NodeContext.layer),
    Effect.withConfigProvider(
      ConfigProvider.fromMap(
        new Map([
          ["SPHYNX_API_KEY", "fixture"],
          ["SPHYNX_BASE_URL", api.url],
          ["SPHYNX_WEB_URL", "https://sphynx.test"],
        ])
      )
    )
  );

describe("a local run while the API is flaky", () => {
  it("records a trial whose report met two 503 pages before it landed", async () => {
    const request = requestWith("touch done.txt");
    const api = fakeApi(request, { "runner.report": [503, 503] });

    const { cases } = await Effect.runPromise(recorded(api, request));

    expect(cases.map((one) => one.status)).toEqual(["passed"]);
    expect(api.calls.get("runner.report")).toBe(3);
    expect(api.reported).toEqual([{ ordinal: 1, runId: "run_1" }]);
    expect(api.finished).toEqual(["batch_1"]);
  }, 60_000);

  it("sends one idempotency key on every attempt to start the batch", async () => {
    const request = requestWith("touch done.txt");
    const api = fakeApi(request, { "runner.start": [502, 504] });

    await Effect.runPromise(recorded(api, request));
    const [first] = api.startKeys;

    expect(api.startKeys).toHaveLength(3);
    expect(first).toMatch(START_KEY);
    expect(api.startKeys).toEqual([first ?? "", first ?? "", first ?? ""]);
    expect(api.finished).toEqual(["batch_1"]);
  }, 60_000);

  it("gives back the cost the server priced when the batch closed", async () => {
    const request = requestWith("touch done.txt");
    const api = fakeApi(request, {});

    const { costs } = await Effect.runPromise(recorded(api, request));

    expect(costs).toEqual(PRICED);
    expect(api.finished).toEqual(["batch_1"]);
  }, 60_000);

  it("runs against a server that has no heartbeat endpoint", async () => {
    const request = requestWith("touch done.txt");
    const api = fakeApi(request, {}, false);

    const { cases } = await Effect.runPromise(recorded(api, request));

    expect(cases.map((one) => one.status)).toEqual(["passed"]);
    expect(api.finished).toEqual(["batch_1"]);
  }, 60_000);

  it("starts its batch through a 502", async () => {
    const request = requestWith("touch done.txt");
    const api = fakeApi(request, { "runner.start": [502] });

    const { cases } = await Effect.runPromise(recorded(api, request));

    expect(cases.map((one) => one.status)).toEqual(["passed"]);
    expect(api.calls.get("runner.start")).toBe(2);
    expect(api.finished).toEqual(["batch_1"]);
  }, 60_000);

  it("reports a trial that ran out of time as broken, with why, and finishes", async () => {
    const request = requestWith("sleep 20", 1000);
    const api = fakeApi(request, {});

    const { cases, link } = await Effect.runPromise(recorded(api, request));

    expect(cases.map((one) => one.status)).toEqual(["timed out"]);
    expect(api.reported).toEqual([
      {
        failure: "The agent ran past its time limit of 1s",
        ordinal: 1,
        runId: "run_1",
      },
    ]);
    expect(api.finished).toEqual(["batch_1"]);
    expect(Option.getOrNull(link)).toBe("https://sphynx.test/evals/batch_1");
  }, 60_000);

  it("still lands a broken trial on a server that predates broken reports", async () => {
    const request = requestWith("sleep 20", 1000);
    const api = fakeApi(request, {}, true, "before-broken-reports");

    const { cases } = await Effect.runPromise(recorded(api, request));

    expect(cases.map((one) => one.status)).toEqual(["timed out"]);
    expect(api.calls.get("runner.report")).toBe(2);
    expect(api.reported).toEqual([
      { ordinal: 1, runId: "run_1", status: "void" },
    ]);
    expect(api.finished).toEqual(["batch_1"]);
  }, 60_000);

  it("stops within seconds when Sphynx cannot be reached at all", async () => {
    const request = requestWith("touch done.txt");
    const startedAt = Date.now();

    const exit = await Effect.runPromiseExit(
      runRecorded("unreachable", request, false).pipe(
        Effect.provide(ClientLayer),
        Effect.provide(NodeContext.layer),
        Effect.withConfigProvider(
          ConfigProvider.fromMap(
            new Map([
              ["SPHYNX_API_KEY", "fixture"],
              ["SPHYNX_BASE_URL", "http://127.0.0.1:1"],
            ])
          )
        )
      )
    );

    expect(Date.now() - startedAt).toBeLessThan(5000);
    expect(
      Exit.isFailure(exit)
        ? asSphynxError(Cause.squash(exit.cause)).message
        : null
    ).toBe(
      "Unable to reach Sphynx at http://127.0.0.1:1. Check your network connection, or set SPHYNX_BASE_URL if your Sphynx server is at another address."
    );
  }, 60_000);

  it("finishes its batch when interrupted mid-trial, even through a 503", async () => {
    const request = requestWith("sleep 30 && touch done.txt");
    const api = fakeApi(request, { "runner.finish": [503] });

    const fiber = Effect.runFork(recorded(api, request));
    await api.started;
    await Bun.sleep(1500);
    const exit = await Effect.runPromise(Fiber.interrupt(fiber));

    expect(Exit.isInterrupted(exit)).toBe(true);
    expect(api.reported).toEqual([]);
    expect(api.finished).toEqual(["batch_1"]);
  }, 60_000);

  it("checks once that Sphynx answers, for the organization and the whole run", async () => {
    const file = resolve(
      import.meta.dir,
      "../../../../scripts/fixtures/local-smoke/smoke.eval.ts"
    );
    const api = fakeApi(await compileFixture(file), {});

    await Effect.runPromise(
      runSuitesLocally(
        [file],
        { caseId: Option.none(), variants: [] },
        { gate: "never", timeoutSeconds: Option.none(), ui: false }
      ).pipe(
        Effect.provide(NodeContext.layer),
        Effect.withConfigProvider(
          ConfigProvider.fromMap(
            new Map([
              ["SPHYNX_API_KEY", "fixture"],
              ["SPHYNX_BASE_URL", api.url],
              ["SPHYNX_WEB_URL", "https://sphynx.test"],
            ])
          )
        )
      )
    );

    expect(api.calls.get("/")).toBe(1);
    expect(api.calls.get("auth.whoami")).toBe(1);
    expect(api.reported).toEqual([{ ordinal: 1, runId: "run_1" }]);
    expect(api.finished).toEqual(["batch_1"]);
  }, 60_000);
});

describe("a local trial too large for Sphynx to take", () => {
  it("records its verdict without the journal, and says so", async () => {
    const request = requestWith(
      `printf '{"_tag":"Message","role":"assistant","text":"%s"}\\n' "$(head -c 100000 /dev/zero | tr '\\0' a)" && touch done.txt`
    );
    const api = fakeApi(request, {}, true, "current", 64 * 1024);
    const said: string[] = [];
    const write = spyOn(process.stderr, "write").mockImplementation((text) => {
      said.push(String(text));
      return true;
    });

    const { cases } = await Effect.runPromise(recorded(api, request)).finally(
      () => write.mockRestore()
    );

    expect({
      journals: api.journals,
      noted: said.filter((line) => line.includes("journal")),
      reported: api.reported,
      statuses: cases.map((one) => one.status),
    }).toEqual({
      journals: [0],
      noted: [
        "A trial of fixture on command/none@writes-done was too large for Sphynx to take, so its verdict was recorded without its journal.\n",
      ],
      reported: [{ ordinal: 1, runId: "run_1" }],
      statuses: ["passed"],
    });
  }, 60_000);
});

describe("a local run whose batch Sphynx already closed", () => {
  it("says so once, without claiming Sphynx will close it later", async () => {
    const request = requestWith("touch done.txt");
    const api = fakeApi(request, { "runner.finish": [409] });
    const said: string[] = [];
    const write = spyOn(process.stderr, "write").mockImplementation((text) => {
      said.push(String(text));
      return true;
    });

    try {
      await Effect.runPromise(recorded(api, request));
    } finally {
      write.mockRestore();
    }

    expect(said.filter((line) => line.includes("closed"))).toEqual([
      `${CLOSED}\n`,
    ]);
  }, 60_000);
});

describe("starting a local batch", () => {
  it("tells Sphynx this CLI checks in, so a silent machine is noticed", async () => {
    const request = requestWith("touch done.txt");
    const api = fakeApi(request, {});

    await Effect.runPromise(recorded(api, request));

    expect(api.startsCheckingIn).toEqual([true]);
  }, 60_000);
});

describe("a local run whose batch Sphynx closes while it runs", () => {
  it("stops at once and fails with the one refusal, instead of reporting into a closed batch", async () => {
    const request = requestWith("sleep 30 && touch done.txt");
    const api = fakeApi(request, { "runner.beat": [409] });
    const said: string[] = [];
    const write = spyOn(process.stderr, "write").mockImplementation((text) => {
      said.push(String(text));
      return true;
    });
    const startedAt = Date.now();

    const exit = await Effect.runPromiseExit(recorded(api, request)).finally(
      () => write.mockRestore()
    );

    expect({
      failure: Exit.isFailure(exit)
        ? asSphynxError(Cause.squash(exit.cause)).message
        : null,
      finished: api.finished,
      noted: said.filter((line) => line.includes("closed")),
      quick: Date.now() - startedAt < 10_000,
      reported: api.reported,
    }).toEqual({
      failure: CLOSED,
      finished: [],
      noted: [],
      quick: true,
      reported: [],
    });
  }, 60_000);
});

describe("a local trial still too large without its journal", () => {
  it("records its verdict without the evidence its checks captured", async () => {
    const request = requestWith("touch done.txt");
    const api = fakeApi(request, { "runner.report": [413, 413] });
    const said: string[] = [];
    const write = spyOn(process.stderr, "write").mockImplementation((text) => {
      said.push(String(text));
      return true;
    });

    const { cases } = await Effect.runPromise(recorded(api, request)).finally(
      () => write.mockRestore()
    );

    expect({
      journals: api.journals,
      noted: said.filter((line) => line.includes("journal")),
      reported: api.reported,
      statuses: cases.map((one) => one.status),
    }).toEqual({
      journals: [0],
      noted: [
        "A trial of fixture on command/none@writes-done was too large for Sphynx to take, so its verdict was recorded without its journal or the evidence its checks captured.\n",
      ],
      reported: [{ ordinal: 1, runId: "run_1" }],
      statuses: ["passed"],
    });
  }, 60_000);
});

const withVariable = async <A>(
  name: string,
  value: string | undefined,
  run: () => Promise<A>
) => {
  const prior = process.env[name];
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
  try {
    return await run();
  } finally {
    if (prior === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = prior;
    }
  }
};

describe("a local run whose profile names variables", () => {
  const names = Array.from(
    { length: 150 },
    (_, index) => `LEASED_VARIABLE_${index}`
  );

  it("leases more names than one request takes, in batches, and hands every one to the agent", async () => {
    const request = requestWith(
      'test "$LEASED_VARIABLE_149" = leased-LEASED_VARIABLE_149 && test "$LEASED_VARIABLE_0" = leased-LEASED_VARIABLE_0 && touch done.txt',
      null,
      names
    );
    const api = fakeApi(request, {});

    const { cases } = await Effect.runPromise(recorded(api, request));

    expect(cases.map((one) => one.status)).toEqual(["passed"]);
    expect(api.leasedNames.map((chunk) => chunk.length)).toEqual([100, 50]);
    expect(api.leasedNames.flat()).toEqual(names);
  }, 60_000);

  it("fails the run with the server's reason when a lease is refused", async () => {
    const request = requestWith("touch done.txt", null, ["SEARCH_API_KEY"]);
    const api = fakeApi(request, { "runner.leaseVariables": [404] });

    const exit = await withVariable("SEARCH_API_KEY", undefined, () =>
      Effect.runPromiseExit(recorded(api, request))
    );

    expect({
      failure: Exit.isFailure(exit)
        ? asSphynxError(Cause.squash(exit.cause)).message
        : null,
      finished: api.finished,
      reported: api.reported,
    }).toEqual({ failure: UNSET, finished: ["batch_1"], reported: [] });
  }, 60_000);

  it("takes an empty shell value as set, without leasing it", async () => {
    const request = requestWith(
      'test -z "$BLANK_ON_PURPOSE" && touch done.txt',
      null,
      ["BLANK_ON_PURPOSE"]
    );
    const api = fakeApi(request, {});

    const { cases } = await withVariable("BLANK_ON_PURPOSE", "", () =>
      Effect.runPromise(recorded(api, request))
    );

    expect(cases.map((one) => one.status)).toEqual(["passed"]);
    expect(api.leasedNames).toEqual([]);
  }, 60_000);
});
