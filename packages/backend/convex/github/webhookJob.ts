import { type Infer, v } from "convex/values";
import {
  headCloseFor,
  headMoveFor,
  projectionFor,
  statusTargetFor,
  workbenchTargetFor,
} from "./projection";
import { workbenchEventFields } from "./validators";
import { webhookToWorkbenchEvent } from "./workbenchMappers";

const pullRefFields = {
  owner: v.string(),
  repo: v.string(),
  number: v.number(),
};
const pullRef = v.object(pullRefFields);

export const webhookJobValidator = v.object({
  installationId: v.union(v.number(), v.null()),
  projection: v.union(
    v.object({
      kind: v.literal("pull"),
      installationId: v.number(),
      ref: pullRef,
    }),
    v.object({
      kind: v.literal("pulls"),
      installationId: v.number(),
      refs: v.array(pullRef),
    }),
    v.object({ kind: v.literal("install"), installationId: v.number() }),
    v.object({ kind: v.literal("retire"), installationId: v.number() }),
    v.object({ kind: v.literal("none") })
  ),
  status: v.union(
    v.object({
      installationId: v.number(),
      owner: v.string(),
      repo: v.string(),
      sha: v.string(),
    }),
    v.null()
  ),
  headClose: v.union(
    v.object({ installationId: v.number(), ...pullRefFields }),
    v.null()
  ),
  headMove: v.union(
    v.object({
      installationId: v.number(),
      owner: v.string(),
      repo: v.string(),
      number: v.number(),
      headSha: v.string(),
    }),
    v.null()
  ),
  workbench: v.union(v.object(workbenchEventFields), v.null()),
});

export type WebhookJob = Infer<typeof webhookJobValidator>;

function normalizedProjection(projection: ReturnType<typeof projectionFor>) {
  if (projection._tag === "Pull") {
    return {
      kind: "pull" as const,
      installationId: projection.installationId,
      ref: projection.ref,
    };
  }
  if (projection._tag === "Pulls") {
    return {
      kind: "pulls" as const,
      installationId: projection.installationId,
      refs: [...projection.refs],
    };
  }
  if (projection._tag === "Install") {
    return {
      kind: "install" as const,
      installationId: projection.installationId,
    };
  }
  if (projection._tag === "Retire") {
    return {
      kind: "retire" as const,
      installationId: projection.installationId,
    };
  }
  return { kind: "none" as const };
}

export function normalizeWebhookJob(
  eventType: string,
  deliveryId: string,
  payload: unknown,
  now: number
): WebhookJob {
  const projection = projectionFor(eventType, payload);
  const target = workbenchTargetFor(payload);
  const event = target
    ? webhookToWorkbenchEvent(
        target.owner,
        target.repo,
        eventType,
        deliveryId,
        new Date(now).toISOString(),
        payload
      )
    : null;
  return {
    installationId:
      projection._tag === "None"
        ? (target?.installationId ?? null)
        : projection.installationId,
    projection: normalizedProjection(projection),
    status: eventType === "status" ? statusTargetFor(payload) : null,
    headClose: eventType === "pull_request" ? headCloseFor(payload) : null,
    headMove: eventType === "pull_request" ? headMoveFor(payload) : null,
    workbench:
      target && event
        ? {
            eventId: event.id,
            installationId: target.installationId,
            owner: target.owner,
            repo: target.repo,
            kind: event.kind,
            actor: event.actor.login,
            actorAvatarUrl: event.actor.avatarUrl || null,
            pullNumber: event.pull?.number ?? null,
            title: event.pull?.title ?? null,
            detail: event.detail,
            url: event.url,
            occurredAt: new Date(event.at).getTime(),
          }
        : null,
  };
}
