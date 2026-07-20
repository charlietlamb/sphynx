import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform";
import { Schema } from "effect";
import {
  GitHubRateLimited,
  GitHubTimeout,
  GitHubUnavailable,
  InstallationRequired,
  PullRequestNotFound,
  PullRequestRefSchema,
  Unauthorized,
} from "./pull-requests";

import { cookieHeaders } from "./shared";

export const ViewedFileSchema = Schema.Struct({
  path: Schema.String,
  viewed: Schema.Boolean,
});

export type ViewedFile = typeof ViewedFileSchema.Type;

export const ViewedFilesSchema = Schema.Struct({
  files: Schema.Array(ViewedFileSchema),
});

export type ViewedFiles = typeof ViewedFilesSchema.Type;

const listViewedFiles = HttpApiEndpoint.get(
  "listViewedFiles",
  "/api/github/repos/:owner/:repo/pulls/:number/viewed-files"
)
  .setPath(PullRequestRefSchema)
  .setHeaders(cookieHeaders)
  .addSuccess(ViewedFilesSchema);

const setFileViewed = HttpApiEndpoint.post(
  "setFileViewed",
  "/api/github/repos/:owner/:repo/pulls/:number/viewed-files"
)
  .setPath(PullRequestRefSchema)
  .setHeaders(cookieHeaders)
  .setPayload(ViewedFileSchema)
  .addSuccess(ViewedFileSchema);

export const AllFilesViewedSchema = Schema.Struct({
  viewed: Schema.Boolean,
});

export type AllFilesViewed = typeof AllFilesViewedSchema.Type;

const setAllFilesViewed = HttpApiEndpoint.post(
  "setAllFilesViewed",
  "/api/github/repos/:owner/:repo/pulls/:number/viewed-files/all"
)
  .setPath(PullRequestRefSchema)
  .setHeaders(cookieHeaders)
  .setPayload(AllFilesViewedSchema)
  .addSuccess(AllFilesViewedSchema);

export const PullRequestViewsApi = HttpApiGroup.make("pullRequestViews")
  .add(listViewedFiles)
  .add(setFileViewed)
  .add(setAllFilesViewed)
  .addError(Unauthorized, { status: 401 })
  .addError(InstallationRequired, { status: 403 })
  .addError(PullRequestNotFound, { status: 404 })
  .addError(GitHubRateLimited, { status: 429 })
  .addError(GitHubUnavailable, { status: 502 })
  .addError(GitHubTimeout, { status: 504 });
