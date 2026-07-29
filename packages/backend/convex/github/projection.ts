import { Option, Schema } from "effect";

export interface PullRequestRef {
  readonly owner: string;
  readonly repo: string;
  readonly number: number;
}

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

const PullHeadSchema = Schema.Struct({
  ...base,
  action: Schema.optional(Schema.String),
  pull_request: Schema.optional(
    Schema.Struct({
      number: Schema.Number,
      state: Schema.optional(Schema.String),
      head: Schema.optional(Schema.Struct({ sha: Schema.String })),
    })
  ),
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

const StatusSchema = Schema.Struct({
  ...base,
  sha: Schema.optional(Schema.String),
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
const decodePullHead = Schema.decodeUnknownOption(PullHeadSchema);
const decodeIssue = Schema.decodeUnknownOption(IssueCommentSchema);
const decodeStatus = Schema.decodeUnknownOption(StatusSchema);
const decodeCheck = Schema.decodeUnknownOption(CheckSchema);
const decodeEnvelope = Schema.decodeUnknownOption(EnvelopeSchema);

interface HeadMove {
  readonly headSha: string;
  readonly installationId: number;
  readonly number: number;
  readonly owner: string;
  readonly repo: string;
}

/** The head sha a `pull_request` delivery moved to, if it carries one. */
export const headMoveFor = (payload: unknown): HeadMove | null => {
  const decoded = decodePullHead(payload);
  if (Option.isNone(decoded)) {
    return null;
  }
  const { installation, repository, pull_request } = decoded.value;
  return installation && repository && pull_request?.head
    ? {
        installationId: installation.id,
        owner: repository.owner.login,
        repo: repository.name,
        number: pull_request.number,
        headSha: pull_request.head.sha,
      }
    : null;
};

interface HeadClose {
  readonly number: number;
  readonly owner: string;
  readonly repo: string;
}

/** The pull a `pull_request` delivery closed, so its head cursor can be dropped. */
export const headCloseFor = (payload: unknown): HeadClose | null => {
  const decoded = decodePullHead(payload);
  if (Option.isNone(decoded)) {
    return null;
  }
  const { action, repository, pull_request } = decoded.value;
  const closed = action === "closed" || pull_request?.state === "closed";
  return closed && repository && pull_request
    ? {
        owner: repository.owner.login,
        repo: repository.name,
        number: pull_request.number,
      }
    : null;
};

interface StatusTarget {
  readonly installationId: number;
  readonly owner: string;
  readonly repo: string;
  readonly sha: string;
}

/**
 * A legacy Commit Status delivery carries a commit sha, not a PR number, so the
 * PR it belongs to is resolved from `pull_head` (the open pull whose head is
 * this sha). Without this, status-only CI (Buildkite, older CircleCI) never
 * refreshes the read model until the reconcile sweep.
 */
export const statusTargetFor = (payload: unknown): StatusTarget | null => {
  const decoded = decodeStatus(payload);
  if (Option.isNone(decoded)) {
    return null;
  }
  const { installation, repository, sha } = decoded.value;
  return installation && repository && sha
    ? {
        installationId: installation.id,
        owner: repository.owner.login,
        repo: repository.name,
        sha,
      }
    : null;
};

interface WorkbenchTarget {
  readonly installationId: number;
  readonly owner: string;
  readonly repo: string;
}

/** The installation + repo a delivery belongs to, if the envelope carries both. */
export const workbenchTargetFor = (payload: unknown): WorkbenchTarget | null => {
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

const CHECK_EVENTS = new Set(["check_run", "check_suite"]);

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
