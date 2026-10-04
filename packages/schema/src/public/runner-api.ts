import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform";
import { Schema } from "effect";
import { VARIABLE_LIMITS, VariableName } from "../domain/environment";
import { BadRequest, Conflict, Forbidden, NotFound } from "../domain/errors";
import { BatchSubscription } from "../domain/eval-batch-subscription";
import { StartBatchRequest } from "../domain/eval-definition";
import { EvalBatchTail, EvalBatchTailRequest } from "../domain/eval-tail";
import { EvalHarness } from "../domain/eval-trial";
import { EvalBatch, StartedBatch } from "../domain/evals";
import {
  HarnessEvent,
  HarnessUsage,
  ModelSpend,
} from "../domain/harness-event";
import { TrialOutcome } from "../domain/trial";
import { ApiKeyAuthentication } from "./authentication";
import { ById, hasOneCheckPerCase, ONE_CHECK_PER_CASE } from "./evals-api";
import { Repeatable } from "./repeatable";

export const CredentialLeaseRequest = Schema.Struct({
  harness: EvalHarness,
  id: Schema.String,
}).annotations({
  description:
    "Ask for the credentials a batch the caller is executing needs, for the harness it names.",
  identifier: "CredentialLeaseRequest",
});
export type CredentialLeaseRequest = typeof CredentialLeaseRequest.Type;

export const CredentialLease = Schema.Struct({
  authMethodId: Schema.String,
  expiresAt: Schema.DateTimeUtc,
  values: Schema.Record({ key: Schema.String, value: Schema.String }),
}).annotations({
  description:
    "Credentials for one batch, held in memory and never written down. Short-lived: start another batch rather than keeping these.",
  identifier: "CredentialLease",
});
export type CredentialLease = typeof CredentialLease.Type;

export const VariableLeaseRequest = Schema.Struct({
  id: Schema.String,
  names: Schema.Array(VariableName).pipe(
    Schema.minItems(1),
    Schema.maxItems(VARIABLE_LIMITS.perRequest)
  ),
}).annotations({
  description:
    "Ask for the variables a profile names, for a batch the caller is executing.",
  identifier: "VariableLeaseRequest",
});
export type VariableLeaseRequest = typeof VariableLeaseRequest.Type;

export const VariableLease = Schema.Struct({
  expiresAt: Schema.DateTimeUtc,
  values: Schema.Record({ key: Schema.String, value: Schema.String }),
}).annotations({
  description:
    "Variables for one batch, held in memory and never written down.",
  identifier: "VariableLease",
});
export type VariableLease = typeof VariableLease.Type;

const ReportedTrialFields = {
  events: Schema.Array(HarnessEvent),
  ordinal: Schema.Int.pipe(Schema.positive()),
  runId: Schema.String,
  sandboxId: Schema.optionalWith(Schema.NullOr(Schema.String), {
    default: () => null,
  }),
  usage: Schema.optionalWith(Schema.NullOr(HarnessUsage), {
    default: () => null,
  }),
};

export const ScoredTrialReport = Schema.Struct({
  ...ReportedTrialFields,
  outcome: TrialOutcome,
  userSpend: Schema.optionalWith(Schema.NullOr(ModelSpend), {
    default: () => null,
  }),
});
export type ScoredTrialReport = typeof ScoredTrialReport.Type;

export const BrokenTrialReport = Schema.Struct({
  ...ReportedTrialFields,
  failure: Schema.String.pipe(Schema.minLength(1)),
});
export type BrokenTrialReport = typeof BrokenTrialReport.Type;

export const ReportedTrial = Schema.Union(
  ScoredTrialReport,
  BrokenTrialReport
).annotations({
  description:
    "One trial a client ran and is reporting: its outcome, or why it could not finish.",
  identifier: "ReportedTrial",
});
export type ReportedTrial = typeof ReportedTrial.Type;

export const IdempotencyKey = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(128),
  Schema.brand("IdempotencyKey")
).annotations({
  description:
    "Chosen by the caller once per batch it means to start, and sent again on every retry, so a retried start returns the batch the first one made.",
  identifier: "IdempotencyKey",
});
export type IdempotencyKey = typeof IdempotencyKey.Type;

const RunnerStartHeaders = Schema.Struct({
  "idempotency-key": Schema.optional(IdempotencyKey),
});

export const RunnerBatchRequest = StartBatchRequest.pipe(
  Schema.filter(
    (request) =>
      request.local ||
      request.variants.every((variant) => variant.sandbox !== "local"),
    {
      message: () =>
        "The local sandbox is only for batches the caller runs itself.",
    }
  ),
  Schema.filter(hasOneCheckPerCase, ONE_CHECK_PER_CASE)
).annotations({ identifier: "RunnerBatchRequest" });

export class RunnerGroup extends HttpApiGroup.make("runner")
  .add(
    HttpApiEndpoint.post("start", "/runner.start")
      .setPayload(RunnerBatchRequest)
      .setHeaders(RunnerStartHeaders)
      .addSuccess(StartedBatch)
  )
  .add(
    HttpApiEndpoint.post("lease", "/runner.lease")
      .annotate(Repeatable, true)
      .setPayload(CredentialLeaseRequest)
      .addSuccess(CredentialLease)
  )
  .add(
    HttpApiEndpoint.post("leaseVariables", "/runner.leaseVariables")
      .annotate(Repeatable, true)
      .setPayload(VariableLeaseRequest)
      .addSuccess(VariableLease)
  )
  .add(
    HttpApiEndpoint.post("report", "/runner.report")
      .setPayload(ReportedTrial)
      .addSuccess(Schema.Void)
  )
  .add(
    HttpApiEndpoint.post("beat", "/runner.beat")
      .annotate(Repeatable, true)
      .setPayload(ById)
      .addSuccess(Schema.Void)
  )
  .add(
    HttpApiEndpoint.post("finish", "/runner.finish")
      .annotate(Repeatable, true)
      .setPayload(ById)
      .addSuccess(EvalBatch)
  )
  .add(
    HttpApiEndpoint.post("subscribe", "/runner.subscribe")
      .annotate(Repeatable, true)
      .setPayload(ById)
      .addSuccess(BatchSubscription)
  )
  .add(
    HttpApiEndpoint.post("tail", "/runner.tail")
      .annotate(Repeatable, true)
      .setPayload(EvalBatchTailRequest)
      .addSuccess(EvalBatchTail)
  )
  .addError(BadRequest)
  .addError(Conflict)
  .addError(Forbidden)
  .addError(NotFound)
  .middleware(ApiKeyAuthentication)
  .annotate(OpenApi.Exclude, true) {}
