import { HttpClientError } from "@effect/platform";
import type {
  LeasedCredential,
  LocalCredentials,
} from "@sphynx/eval/credentials/env-resolver";
import {
  LOCAL_BEAT_EVERY,
  LOCAL_QUIET_AFTER,
} from "@sphynx/eval/domain/local-heartbeat";
import { harnessesNeeded } from "@sphynx/eval/domain/suite-harnesses";
import { VARIABLE_LIMITS } from "@sphynx/schema/domain/environment";
import type { StartBatchRequest } from "@sphynx/schema/domain/eval-definition";
import type { EvalHarness } from "@sphynx/schema/domain/eval-trial";
import type { StartedBatch } from "@sphynx/schema/domain/evals";
import { SphynxApi, type SphynxClient } from "@sphynx/schema/public/client";
import { IdempotencyKey } from "@sphynx/schema/public/runner-api";
import {
  Array as Arr,
  Cause,
  Data,
  Duration,
  Effect,
  Exit,
  Option,
  Random,
  Schedule,
} from "effect";
import { webUrlConfig } from "../client/config";
import { asSphynxError } from "../client/errors";
import { labelOfRequest, runLocally } from "./eval-local";
import { reportStarted } from "./eval-report";
import { evalTrigger } from "./eval-trigger";
import { batchUrl } from "./github-check";
import { runIdsFor } from "./local-run-ids";
import {
  type LocalTrialResult,
  type ReportRequest,
  reportRequest,
  unscoredForOlderServer,
  withoutEvidence,
  withoutJournal,
} from "./local-trial-result";
import { openBrowser } from "./open-browser";
import { note } from "./render";
import { retryTransient } from "./transient";

const namedVariables = (request: StartBatchRequest) => [
  ...new Set(
    request.variants.flatMap((variant) => variant.profile?.variables ?? [])
  ),
];

const fromShell = (names: readonly string[]) =>
  Object.fromEntries(
    names.flatMap((name) => {
      const value = process.env[name];
      return value === undefined ? [] : [[name, value] as const];
    })
  );

const leasesFor = (request: StartBatchRequest, batchId: string) =>
  Effect.gen(function* () {
    const api = yield* SphynxApi;
    const leased = yield* Effect.forEach(harnessesNeeded(request), (harness) =>
      retryTransient(
        api.runner.lease({ payload: { harness, id: batchId } })
      ).pipe(
        Effect.map(
          (lease) =>
            [
              harness,
              { authMethodId: lease.authMethodId, values: lease.values },
            ] as const
        ),
        Effect.option
      )
    );
    const names = namedVariables(request);
    const shell = fromShell(names);
    const missing = names.filter((name) => shell[name] === undefined);
    const leases = yield* Effect.forEach(
      Arr.chunksOf(missing, VARIABLE_LIMITS.perRequest),
      (chunk) =>
        retryTransient(
          api.runner.leaseVariables({ payload: { id: batchId, names: chunk } })
        )
    );
    const variables = Object.assign({}, ...leases.map((lease) => lease.values));

    return {
      credentials: new Map<EvalHarness, LeasedCredential>(
        leased.flatMap(Option.toArray)
      ),
      variables: { ...variables, ...shell },
    } satisfies LocalCredentials;
  });

const CLOSED_BATCH = 409;

const finishBatch = (batchId: string) =>
  SphynxApi.pipe(
    Effect.flatMap((api) =>
      retryTransient(api.runner.finish({ payload: { id: batchId } }))
    ),
    Effect.map((batch) => batch.costs),
    Effect.catchAll((error) => {
      const refused = asSphynxError(error);

      return note(
        refused.status === CLOSED_BATCH
          ? refused.message
          : `Batch ${batchId} was not closed. Sphynx marks it failed ${Duration.toMinutes(LOCAL_QUIET_AFTER)} minutes after this machine stops checking in. ${refused.message}`
      ).pipe(Effect.as(null));
    })
  );

const startKey = Effect.map(
  Effect.all(Arr.makeBy(4, () => Random.nextIntBetween(0, 2 ** 32))),
  (words) =>
    IdempotencyKey.make(
      words.map((word) => word.toString(16).padStart(8, "0")).join("")
    )
);

const openBatch = (request: StartBatchRequest) =>
  Effect.gen(function* () {
    const api = yield* SphynxApi;
    const trigger = yield* evalTrigger;
    const key = yield* startKey;

    return yield* Effect.acquireRelease(
      retryTransient(
        api.runner.start({
          headers: { "idempotency-key": key },
          payload: { ...request, checksIn: true, local: true, trigger },
        })
      ),
      (started, exit) =>
        Exit.isSuccess(exit) || closedBy(exit)
          ? Effect.void
          : Effect.asVoid(finishBatch(started.id))
    );
  });

class BatchClosed extends Data.TaggedError("BatchClosed")<{
  readonly message: string;
}> {}

const closedBy = (exit: Exit.Exit<unknown, unknown>) =>
  Exit.isFailure(exit) &&
  Option.exists(
    Cause.failureOption(exit.cause),
    (error) => error instanceof BatchClosed
  );

const untilClosed = (batchId: string) =>
  SphynxApi.pipe(
    Effect.flatMap((api) => api.runner.beat({ payload: { id: batchId } })),
    Effect.catchAll((error) => {
      const refused = asSphynxError(error);

      return refused.status === CLOSED_BATCH
        ? Effect.fail(new BatchClosed({ message: refused.message }))
        : Effect.void;
    }),
    Effect.repeat(Schedule.spaced(LOCAL_BEAT_EVERY)),
    Effect.zipRight(Effect.never)
  );

const TOO_LARGE = 413;

const tooLarge = (error: unknown) =>
  HttpClientError.isHttpClientError(error) &&
  error._tag === "ResponseError" &&
  error.response.status === TOO_LARGE;

const SHRUNK = [
  { gaveUp: "its journal", shrink: withoutJournal },
  {
    gaveUp: "its journal or the evidence its checks captured",
    shrink: (result: LocalTrialResult) =>
      withoutEvidence(withoutJournal(result)),
  },
] as const;

const reportTrial = (
  api: SphynxClient,
  result: LocalTrialResult,
  ordinal: number,
  runId: string,
  trial: string
) => {
  const send = (request: ReportRequest) =>
    retryTransient(api.runner.report(request));

  const sendTrial = (sent: LocalTrialResult) =>
    send(reportRequest(sent, ordinal, runId)).pipe(
      Effect.catchTag("HttpApiDecodeError", (refused) =>
        sent.kind === "broken"
          ? send(unscoredForOlderServer(sent, ordinal, runId))
          : Effect.fail(refused)
      )
    );

  return SHRUNK.reduce(
    (attempt, rung) =>
      attempt.pipe(
        Effect.catchIf(tooLarge, () =>
          sendTrial(rung.shrink(result)).pipe(
            Effect.zipRight(
              note(
                `A trial of ${trial} was too large for Sphynx to take, so its verdict was recorded without ${rung.gaveUp}.`
              )
            )
          )
        )
      ),
    sendTrial(result)
  );
};

const recordInto = (
  label: string,
  request: StartBatchRequest,
  ui: boolean,
  started: StartedBatch
) =>
  Effect.gen(function* () {
    const api = yield* SphynxApi;
    const link = batchUrl(yield* webUrlConfig, started.id);

    yield* reportStarted(label, started.id);

    if (ui) {
      yield* openBrowser(link);
    }

    const batch = yield* retryTransient(
      api.batches.get({ payload: { id: started.id } })
    );
    const runIdOf = yield* runIdsFor(request, started, batch);
    const leases = yield* leasesFor(request, started.id);

    const cases = yield* runLocally(request, {
      credentials: leases,
      onTrial: (slot, result, ordinal) => {
        const trial = `${slot.caseId} on ${labelOfRequest(slot.variant)}`;

        return reportTrial(api, result, ordinal, runIdOf(slot), trial).pipe(
          Effect.catchAll((error) =>
            note(
              `A trial of ${trial} was not recorded, so it shows as void. ${asSphynxError(error).message}`
            )
          )
        );
      },
    });

    return {
      cases,
      costs: yield* finishBatch(started.id),
      link: Option.some(link),
    };
  });

export const runRecorded = (
  label: string,
  request: StartBatchRequest,
  ui: boolean
) =>
  Effect.gen(function* () {
    const started = yield* openBatch(request);

    return yield* Effect.raceFirst(
      recordInto(label, request, ui, started),
      untilClosed(started.id)
    );
  }).pipe(Effect.scoped);
