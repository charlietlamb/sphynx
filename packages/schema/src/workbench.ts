import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform";
import { Schema } from "effect";
import { Unauthorized } from "./pull-request-views";
import {
  GitHubRateLimited,
  GitHubTimeout,
  GitHubUnavailable,
  GitHubUserSchema,
  PullRequestNotFound,
} from "./pull-requests";
import { RepoRefSchema } from "./review-queue";
import { cookieHeaders } from "./shared";

export const WorkbenchEventKindSchema = Schema.Literal(
  "pr-opened",
  "pr-merged",
  "pr-closed",
  "pr-reopened",
  "pr-ready",
  "review-approved",
  "review-changes",
  "review-commented",
  "comment",
  "push",
  "branch-created",
  "branch-deleted",
  "release"
);

export type WorkbenchEventKind = typeof WorkbenchEventKindSchema.Type;

export const WorkbenchEventSchema = Schema.Struct({
  id: Schema.String,
  at: Schema.String,
  actor: GitHubUserSchema,
  kind: WorkbenchEventKindSchema,
  pull: Schema.NullOr(
    Schema.Struct({ number: Schema.Number, title: Schema.String })
  ),
  detail: Schema.NullOr(Schema.String),
  url: Schema.NullOr(Schema.String),
});

export type WorkbenchEvent = typeof WorkbenchEventSchema.Type;

export const WorkbenchFeedSchema = Schema.Struct({
  events: Schema.Array(WorkbenchEventSchema),
});

export type WorkbenchFeed = typeof WorkbenchFeedSchema.Type;

const getRepoEvents = HttpApiEndpoint.get(
  "getRepoEvents",
  "/api/github/repos/:owner/:repo/events"
)
  .setPath(RepoRefSchema)
  .setHeaders(cookieHeaders)
  .addSuccess(WorkbenchFeedSchema);

const getDevRepoEvents = HttpApiEndpoint.get(
  "getDevRepoEvents",
  "/api/dev/repos/:owner/:repo/events"
)
  .setPath(RepoRefSchema)
  .addSuccess(WorkbenchFeedSchema);

export const WorkbenchApi = HttpApiGroup.make("workbench")
  .add(getRepoEvents)
  .add(getDevRepoEvents)
  .addError(Unauthorized, { status: 401 })
  .addError(PullRequestNotFound, { status: 404 })
  .addError(GitHubRateLimited, { status: 429 })
  .addError(GitHubUnavailable, { status: 502 })
  .addError(GitHubTimeout, { status: 504 });
