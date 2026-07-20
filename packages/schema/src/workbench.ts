import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform";
import { Schema } from "effect";
import {
  GitHubRateLimited,
  GitHubTimeout,
  GitHubUnavailable,
  GitHubUserSchema,
  InstallationRequired,
  PullRequestNotFound,
  Unauthorized,
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
    Schema.Struct({
      number: Schema.Number,
      title: Schema.NullOr(Schema.String),
    })
  ),
  detail: Schema.NullOr(Schema.String),
  url: Schema.NullOr(Schema.String),
});

export type WorkbenchEvent = typeof WorkbenchEventSchema.Type;

export const WorkbenchFeedSchema = Schema.Struct({
  events: Schema.Array(WorkbenchEventSchema),
  viewer: Schema.NullOr(Schema.String),
});

export type WorkbenchFeed = typeof WorkbenchFeedSchema.Type;

const getRepoEvents = HttpApiEndpoint.get(
  "getRepoEvents",
  "/api/github/repos/:owner/:repo/events"
)
  .setPath(RepoRefSchema)
  .setHeaders(cookieHeaders)
  .addSuccess(WorkbenchFeedSchema);

export const WorkbenchApi = HttpApiGroup.make("workbench")
  .add(getRepoEvents)
  .addError(Unauthorized, { status: 401 })
  .addError(InstallationRequired, { status: 403 })
  .addError(PullRequestNotFound, { status: 404 })
  .addError(GitHubRateLimited, { status: 429 })
  .addError(GitHubUnavailable, { status: 502 })
  .addError(GitHubTimeout, { status: 504 });
