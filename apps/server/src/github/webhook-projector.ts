import type { PullRequestRef } from "@sphynx/schema/pull-requests";
import { Clock, Context, Effect, Layer, Option, Schema } from "effect";
import { GitHubAppAuth } from "./app-auth";
import { Materializer } from "./materializer";
import { workbenchEventRow } from "./read-model-rows";
import { ReadModelWriter } from "./read-model-writer";
import { GitHubReviewQueue } from "./review-queue";
import { webhookToWorkbenchEvent } from "./workbench-mappers";

const RepoSchema = Schema.Struct({
  name: Schema.String,
  owner: Schema.Struct({ login: Schema.String }),
});

const InstallationSchema = Schema.Struct({ id: Schema.Number });

const base = {
  installation: Schema.optional(InstallationSchema),
  repository: Schema.optional(RepoSchema),
};

const PullNumberSchema = Schema.Struct({
  ...base,
  pull_request: Schema.optional(Schema.Struct({ number: Schema.Number })),
});

const IssueCommentSchema = Schema.Struct({
  ...base,
  issue: Schema.optional(
    Schema.Struct({
      number: Schema.Number,
      pull_request: Schema.optional(Schema.Unknown),
    })
  ),
});

const CheckSchema = Schema.Struct({
  ...base,
  check_run: Schema.optional(
    Schema.Struct({
      pull_requests: Schema.optional(
        Schema.Array(Schema.Struct({ number: Schema.Number }))
      ),
    })
  ),
  check_suite: Schema.optional(
    Schema.Struct({
      pull_requests: Schema.optional(
        Schema.Array(Schema.Struct({ number: Schema.Number }))
      ),
    })
  ),
});

/** What a delivery asks the read model to re-derive. */
export type Projection =
  | {
      readonly _tag: "Pull";
      readonly installationId: number;
      readonly ref: PullRequestRef;
    }
  | { readonly _tag: "Install"; readonly installationId: number }
  | { readonly _tag: "None" };

const EnvelopeSchema = Schema.Struct(base);

const decodePull = Schema.decodeUnknownOption(PullNumberSchema);
const decodeIssue = Schema.decodeUnknownOption(IssueCommentSchema);
const decodeCheck = Schema.decodeUnknownOption(CheckSchema);
const decodeEnvelope = Schema.decodeUnknownOption(EnvelopeSchema);

interface WorkbenchTarget {
  readonly installationId: number;
  readonly owner: string;
  readonly repo: string;
}

/** The installation + repo a delivery belongs to, if the envelope carries both. */
const workbenchTargetFor = (payload: unknown): WorkbenchTarget | null => {
  const decoded = decodeEnvelope(payload);
  if (Option.isNone(decoded)) {
    return null;
  }
  const { installation, repository } = decoded.value;
  return installation && repository
    ? {
        installationId: installation.id,
        owner: repository.owner.login,
        repo: repository.name,
      }
    : null;
};

const pullFrom = (
  installationId: number,
  owner: string,
  repo: string,
  number: number
): Projection => ({
  _tag: "Pull",
  installationId,
  ref: { owner, repo, number },
});

const NONE: Projection = { _tag: "None" };

const PULL_EVENTS = new Set([
  "pull_request",
  "pull_request_review",
  "pull_request_review_comment",
  "pull_request_review_thread",
]);

const CHECK_EVENTS = new Set(["check_run", "check_suite", "status"]);

const INSTALL_EVENTS = new Set(["installation", "installation_repositories"]);

const fromInstallEvent = (payload: unknown): Projection => {
  const decoded = decodePull(payload);
  if (decoded._tag === "None" || !decoded.value.installation) {
    return NONE;
  }
  return { _tag: "Install", installationId: decoded.value.installation.id };
};

const fromPullEvent = (payload: unknown): Projection => {
  const decoded = decodePull(payload);
  if (decoded._tag === "None") {
    return NONE;
  }
  const { installation, repository, pull_request } = decoded.value;
  return installation && repository && pull_request
    ? pullFrom(
        installation.id,
        repository.owner.login,
        repository.name,
        pull_request.number
      )
    : NONE;
};

const fromIssueComment = (payload: unknown): Projection => {
  const decoded = decodeIssue(payload);
  if (decoded._tag === "None") {
    return NONE;
  }
  const { installation, repository, issue } = decoded.value;
  return installation && repository && issue?.pull_request
    ? pullFrom(
        installation.id,
        repository.owner.login,
        repository.name,
        issue.number
      )
    : NONE;
};

const fromCheckEvent = (payload: unknown): Projection => {
  const decoded = decodeCheck(payload);
  if (decoded._tag === "None") {
    return NONE;
  }
  const { installation, repository, check_run, check_suite } = decoded.value;
  const number =
    check_run?.pull_requests?.[0]?.number ??
    check_suite?.pull_requests?.[0]?.number ??
    null;
  return installation && repository && number !== null
    ? pullFrom(installation.id, repository.owner.login, repository.name, number)
    : NONE;
};

/**
 * Reduce a delivery to the one PR it should refresh. Repo/owner/installation
 * come from the envelope; the PR number's location varies by event family.
 * Events without a resolvable PR (pushes, installs, non-PR issue comments)
 * map to None here — the rail recompute and backfill handle those.
 */
export const projectionFor = (
  eventType: string,
  payload: unknown
): Projection => {
  if (PULL_EVENTS.has(eventType)) {
    return fromPullEvent(payload);
  }
  if (eventType === "issue_comment") {
    return fromIssueComment(payload);
  }
  if (CHECK_EVENTS.has(eventType)) {
    return fromCheckEvent(payload);
  }
  if (INSTALL_EVENTS.has(eventType)) {
    return fromInstallEvent(payload);
  }
  return NONE;
};

const makeWebhookProjector = Effect.gen(function* () {
  const app = yield* GitHubAppAuth;
  const queue = yield* GitHubReviewQueue;
  const writer = yield* ReadModelWriter;
  const materializer = yield* Materializer;

  const projectPull = (installationId: number, ref: PullRequestRef) =>
    Effect.gen(function* () {
      const credential = app.installationCredential(installationId);
      const token = yield* credential.token;
      const pull = yield* queue.refreshPull(ref, token);
      yield* writer.writePull(installationId, ref.owner, ref.repo, pull);
    });

  /**
   * Append this delivery to the workbench feed, if it maps to a feed event.
   * Runs for every delivery independent of the queue projection, so a
   * pull_request both refreshes the PR row and lands in the feed.
   */
  const projectWorkbench = (
    eventType: string,
    deliveryId: string,
    payload: unknown
  ) =>
    Effect.gen(function* () {
      const target = workbenchTargetFor(payload);
      if (target === null) {
        return;
      }
      const occurredAt = new Date(yield* Clock.currentTimeMillis).toISOString();
      const event = webhookToWorkbenchEvent(
        target.owner,
        target.repo,
        eventType,
        deliveryId,
        occurredAt,
        payload
      );
      if (event) {
        yield* writer.writeWorkbenchEvents(target.installationId, [
          workbenchEventRow(
            target.installationId,
            target.owner,
            target.repo,
            event
          ),
        ]);
      }
    });

  const project = (eventType: string, deliveryId: string, payload: unknown) =>
    Effect.gen(function* () {
      const projection = projectionFor(eventType, payload);
      if (projection._tag === "Pull") {
        yield* projectPull(projection.installationId, projection.ref);
      } else if (projection._tag === "Install") {
        yield* materializer.materialize(projection.installationId);
      }
      yield* projectWorkbench(eventType, deliveryId, payload);
    }).pipe(
      Effect.catchAllCause((cause) =>
        Effect.logWarning("webhook projection failed", cause)
      ),
      Effect.withSpan("WebhookProjector.project"),
      Effect.annotateLogs({ "github.event": eventType })
    );

  return { project };
});

export class WebhookProjector extends Context.Tag(
  "@sphynx/server/WebhookProjector"
)<WebhookProjector, Effect.Effect.Success<typeof makeWebhookProjector>>() {}

export const WebhookProjectorLive = Layer.effect(
  WebhookProjector,
  makeWebhookProjector
);
