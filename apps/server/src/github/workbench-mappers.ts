import type {
  WorkbenchEvent,
  WorkbenchEventKind,
} from "@sphynx/schema/workbench";
import { Option, Schema } from "effect";
import { previewBody } from "./queue-mappers";

const RawEventSchema = Schema.Struct({
  id: Schema.String,
  type: Schema.NullOr(Schema.String),
  actor: Schema.Struct({ login: Schema.String, avatar_url: Schema.String }),
  created_at: Schema.NullOr(Schema.String),
  payload: Schema.optionalWith(Schema.Unknown, { default: () => null }),
});

const RawBranchTipSchema = Schema.Struct({
  ref: Schema.NullishOr(Schema.String),
});

const RawPullPayloadSchema = Schema.Struct({
  action: Schema.String,
  pull_request: Schema.Struct({
    number: Schema.Number,
    title: Schema.NullishOr(Schema.String),
    html_url: Schema.NullishOr(Schema.String),
    merged: Schema.NullishOr(Schema.Boolean),
    head: Schema.NullishOr(RawBranchTipSchema),
    base: Schema.NullishOr(RawBranchTipSchema),
  }),
});

const RawReviewPayloadSchema = Schema.Struct({
  action: Schema.String,
  review: Schema.Struct({
    state: Schema.NullishOr(Schema.String),
    html_url: Schema.NullishOr(Schema.String),
  }),
  pull_request: Schema.Struct({
    number: Schema.Number,
    title: Schema.NullishOr(Schema.String),
    html_url: Schema.NullishOr(Schema.String),
  }),
});

const RawReviewCommentPayloadSchema = Schema.Struct({
  action: Schema.String,
  comment: Schema.Struct({
    html_url: Schema.NullishOr(Schema.String),
    body: Schema.NullishOr(Schema.String),
    path: Schema.NullishOr(Schema.String),
  }),
  pull_request: Schema.Struct({
    number: Schema.Number,
    title: Schema.NullishOr(Schema.String),
  }),
});

const RawIssueCommentPayloadSchema = Schema.Struct({
  action: Schema.String,
  issue: Schema.Struct({
    number: Schema.Number,
    title: Schema.String,
    pull_request: Schema.optional(Schema.Unknown),
  }),
  comment: Schema.Struct({
    html_url: Schema.NullishOr(Schema.String),
    body: Schema.NullishOr(Schema.String),
  }),
});

const RawPushPayloadSchema = Schema.Struct({
  ref: Schema.String,
  size: Schema.NullishOr(Schema.Number),
  distinct_size: Schema.NullishOr(Schema.Number),
  before: Schema.NullishOr(Schema.String),
  head: Schema.NullishOr(Schema.String),
});

const RawRefPayloadSchema = Schema.Struct({
  ref: Schema.NullOr(Schema.String),
  ref_type: Schema.String,
});

const RawReleasePayloadSchema = Schema.Struct({
  action: Schema.String,
  release: Schema.Struct({
    name: Schema.NullishOr(Schema.String),
    tag_name: Schema.String,
    html_url: Schema.NullishOr(Schema.String),
  }),
});

const decodeEnvelope = Schema.decodeUnknownOption(RawEventSchema);
const decodePullPayload = Schema.decodeUnknownOption(RawPullPayloadSchema);
const decodeReviewPayload = Schema.decodeUnknownOption(RawReviewPayloadSchema);
const decodeReviewCommentPayload = Schema.decodeUnknownOption(
  RawReviewCommentPayloadSchema
);
const decodeIssueCommentPayload = Schema.decodeUnknownOption(
  RawIssueCommentPayloadSchema
);
const decodePushPayload = Schema.decodeUnknownOption(RawPushPayloadSchema);
const decodeRefPayload = Schema.decodeUnknownOption(RawRefPayloadSchema);
const decodeReleasePayload = Schema.decodeUnknownOption(
  RawReleasePayloadSchema
);

const BOT_SUFFIX = /\[bot\]$/;

interface EventBase {
  actor: { login: string; avatarUrl: string };
  at: string;
  id: string;
}

const PULL_KINDS: Record<string, WorkbenchEventKind> = {
  opened: "pr-opened",
  reopened: "pr-reopened",
  ready_for_review: "pr-ready",
  merged: "pr-merged",
};

function pullKind(
  action: string,
  merged: boolean
): WorkbenchEventKind | undefined {
  if (action === "closed") {
    return merged ? "pr-merged" : "pr-closed";
  }
  return PULL_KINDS[action];
}

function pullUrl(owner: string, repo: string, number: number) {
  return `https://github.com/${owner}/${repo}/pull/${number}`;
}

function fromPull(
  base: EventBase,
  payload: unknown,
  owner: string,
  repo: string
): WorkbenchEvent | null {
  const decoded = decodePullPayload(payload);
  if (Option.isNone(decoded)) {
    return null;
  }
  const { action, pull_request } = decoded.value;
  const kind = pullKind(action, pull_request.merged ?? false);
  if (!kind) {
    return null;
  }
  const headRef = pull_request.head?.ref ?? null;
  const baseRef = pull_request.base?.ref ?? null;
  return {
    ...base,
    kind,
    pull: { number: pull_request.number, title: pull_request.title ?? null },
    detail: headRef && baseRef ? `${headRef} → ${baseRef}` : null,
    url: pull_request.html_url ?? pullUrl(owner, repo, pull_request.number),
  };
}

const REVIEW_KINDS: Record<string, WorkbenchEventKind> = {
  approved: "review-approved",
  changes_requested: "review-changes",
};

/**
 * The Events API reports a submitted review as `created`; webhooks report it as
 * `submitted`. Accept both so the same mapper serves the seed backfill and the
 * live webhook stream.
 */
const REVIEW_ACTIONS = new Set(["created", "submitted"]);

function fromReview(
  base: EventBase,
  payload: unknown,
  owner: string,
  repo: string
): WorkbenchEvent | null {
  const decoded = decodeReviewPayload(payload);
  if (Option.isNone(decoded) || !REVIEW_ACTIONS.has(decoded.value.action)) {
    return null;
  }
  const { review, pull_request } = decoded.value;
  return {
    ...base,
    kind: REVIEW_KINDS[review.state ?? ""] ?? "review-commented",
    pull: {
      number: pull_request.number,
      title: pull_request.title ?? null,
    },
    detail: null,
    url:
      review.html_url ??
      pull_request.html_url ??
      pullUrl(owner, repo, pull_request.number),
  };
}

function fromReviewComment(
  base: EventBase,
  payload: unknown
): WorkbenchEvent | null {
  const decoded = decodeReviewCommentPayload(payload);
  if (Option.isNone(decoded) || decoded.value.action !== "created") {
    return null;
  }
  const { comment, pull_request } = decoded.value;
  const snippet = comment.body ? previewBody(comment.body) : "";
  return {
    ...base,
    kind: "comment",
    pull: {
      number: pull_request.number,
      title: pull_request.title ?? null,
    },
    detail: snippet.length > 0 ? snippet : (comment.path ?? null),
    url: comment.html_url ?? null,
  };
}

function fromIssueComment(
  base: EventBase,
  payload: unknown
): WorkbenchEvent | null {
  const decoded = decodeIssueCommentPayload(payload);
  if (Option.isNone(decoded) || decoded.value.action !== "created") {
    return null;
  }
  const { issue, comment } = decoded.value;
  const snippet = comment.body ? previewBody(comment.body) : "";
  return {
    ...base,
    kind: "comment",
    pull:
      issue.pull_request === undefined
        ? null
        : { number: issue.number, title: issue.title },
    detail: snippet.length > 0 ? snippet : null,
    url: comment.html_url ?? null,
  };
}

const BRANCH_REF = /^refs\/heads\//;

function fromPush(
  base: EventBase,
  payload: unknown,
  owner: string,
  repo: string
): WorkbenchEvent | null {
  const decoded = decodePushPayload(payload);
  if (Option.isNone(decoded) || !BRANCH_REF.test(decoded.value.ref)) {
    return null;
  }
  const { ref, size, distinct_size, before, head } = decoded.value;
  const branch = ref.replace(BRANCH_REF, "");
  const count = distinct_size ?? size ?? 0;
  return {
    ...base,
    kind: "push",
    pull: null,
    detail:
      count > 0
        ? `${branch} · ${count} commit${count === 1 ? "" : "s"}`
        : branch,
    url:
      before && head
        ? `https://github.com/${owner}/${repo}/compare/${before}...${head}`
        : null,
  };
}

function fromRef(
  base: EventBase,
  payload: unknown,
  kind: "branch-created" | "branch-deleted",
  owner: string,
  repo: string
): WorkbenchEvent | null {
  const decoded = decodeRefPayload(payload);
  if (
    Option.isNone(decoded) ||
    decoded.value.ref_type !== "branch" ||
    !decoded.value.ref
  ) {
    return null;
  }
  const ref = decoded.value.ref;
  return {
    ...base,
    kind,
    pull: null,
    detail: ref,
    url:
      kind === "branch-created"
        ? `https://github.com/${owner}/${repo}/tree/${ref}`
        : null,
  };
}

function fromRelease(base: EventBase, payload: unknown): WorkbenchEvent | null {
  const decoded = decodeReleasePayload(payload);
  if (Option.isNone(decoded) || decoded.value.action !== "published") {
    return null;
  }
  const { release } = decoded.value;
  return {
    ...base,
    kind: "release",
    pull: null,
    detail: release.name ?? release.tag_name,
    url: release.html_url ?? null,
  };
}

/**
 * Dispatch a decoded event to the mapper for its Events-API type. The `base`
 * (id, timestamp, actor) is already assembled, and `payload` is the type's
 * payload object — identical whether it came from the Events API's `payload`
 * field or a webhook body, so both entry points share this.
 */
function dispatchByType(
  type: string,
  base: EventBase,
  payload: unknown,
  owner: string,
  repo: string
): WorkbenchEvent | null {
  switch (type) {
    case "PullRequestEvent":
      return fromPull(base, payload, owner, repo);
    case "PullRequestReviewEvent":
      return fromReview(base, payload, owner, repo);
    case "PullRequestReviewCommentEvent":
      return fromReviewComment(base, payload);
    case "IssueCommentEvent":
      return fromIssueComment(base, payload);
    case "PushEvent":
      return fromPush(base, payload, owner, repo);
    case "CreateEvent":
      return fromRef(base, payload, "branch-created", owner, repo);
    case "DeleteEvent":
      return fromRef(base, payload, "branch-deleted", owner, repo);
    case "ReleaseEvent":
      return fromRelease(base, payload);
    default:
      return null;
  }
}

export function toWorkbenchEvent(
  owner: string,
  repo: string,
  raw: unknown
): WorkbenchEvent | null {
  const envelope = decodeEnvelope(raw);
  if (Option.isNone(envelope)) {
    return null;
  }
  const { id, type, actor, created_at, payload } = envelope.value;
  if (!(type && created_at)) {
    return null;
  }
  const base: EventBase = {
    id,
    at: created_at,
    actor: {
      login: actor.login.replace(BOT_SUFFIX, ""),
      avatarUrl: actor.avatar_url,
    },
  };
  return dispatchByType(type, base, payload, owner, repo);
}

/**
 * The Events-API type name for a webhook `x-github-event` header. Webhooks name
 * events by resource (`pull_request`), the Events API by class name
 * (`PullRequestEvent`); the payload objects underneath are the same, so mapping
 * the header lets the webhook body flow through the shared `dispatchByType`.
 */
const WEBHOOK_EVENT_TYPES: Record<string, string> = {
  pull_request: "PullRequestEvent",
  pull_request_review: "PullRequestReviewEvent",
  pull_request_review_comment: "PullRequestReviewCommentEvent",
  issue_comment: "IssueCommentEvent",
  push: "PushEvent",
  create: "CreateEvent",
  delete: "DeleteEvent",
  release: "ReleaseEvent",
};

const WebhookSenderSchema = Schema.Struct({
  sender: Schema.optional(
    Schema.Struct({
      login: Schema.String,
      avatar_url: Schema.NullishOr(Schema.String),
    })
  ),
});

const decodeSender = Schema.decodeUnknownOption(WebhookSenderSchema);

/**
 * Map a raw webhook delivery to a workbench event, reusing the same per-type
 * mappers as the Events-API path. The actor comes from `sender`, the id and
 * timestamp are supplied by the caller (delivery id + `Clock`), and the webhook
 * body IS the payload.
 */
export function webhookToWorkbenchEvent(
  owner: string,
  repo: string,
  eventType: string,
  deliveryId: string,
  occurredAt: string,
  payload: unknown
): WorkbenchEvent | null {
  const type = WEBHOOK_EVENT_TYPES[eventType];
  if (!type) {
    return null;
  }
  const sender = decodeSender(payload);
  if (Option.isNone(sender) || !sender.value.sender) {
    return null;
  }
  const base: EventBase = {
    id: deliveryId,
    at: occurredAt,
    actor: {
      login: sender.value.sender.login.replace(BOT_SUFFIX, ""),
      avatarUrl: sender.value.sender.avatar_url ?? "",
    },
  };
  return dispatchByType(type, base, payload, owner, repo);
}

export function toWorkbenchEvents(
  owner: string,
  repo: string,
  raw: readonly unknown[]
): WorkbenchEvent[] {
  return raw
    .flatMap((entry) => {
      const event = toWorkbenchEvent(owner, repo, entry);
      return event ? [event] : [];
    })
    .sort((a, b) => b.at.localeCompare(a.at));
}
