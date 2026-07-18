import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "@effect/platform";
import { Schema } from "effect";
import { PullRequestCommentsApi } from "./pull-request-comments";
import { PullRequestViewsApi } from "./pull-request-views";
import { PullRequestsApi } from "./pull-requests";
import { ReviewQueueApi } from "./review-queue";
import { WorkbenchApi } from "./workbench";

export const HealthResponseSchema = Schema.Struct({
  ok: Schema.Boolean,
});

export type HealthResponse = typeof HealthResponseSchema.Type;

export const HealthApi = HttpApiGroup.make("health").add(
  HttpApiEndpoint.get("health", "/healthz").addSuccess(HealthResponseSchema)
);

export class SphynxApi extends HttpApi.make("sphynx")
  .add(HealthApi)
  .add(PullRequestsApi)
  .add(PullRequestViewsApi)
  .add(PullRequestCommentsApi)
  .add(ReviewQueueApi)
  .add(WorkbenchApi) {}
