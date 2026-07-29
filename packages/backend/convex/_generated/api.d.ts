/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as github_appAuth from "../github/appAuth.js";
import type * as github_appJwt from "../github/appJwt.js";
import type * as github_conversationWrite from "../github/conversationWrite.js";
import type * as github_domain from "../github/domain.js";
import type * as github_gate from "../github/gate.js";
import type * as github_githubClient from "../github/githubClient.js";
import type * as github_githubErrors from "../github/githubErrors.js";
import type * as github_ingest from "../github/ingest.js";
import type * as github_installationToken from "../github/installationToken.js";
import type * as github_installations from "../github/installations.js";
import type * as github_materialize from "../github/materialize.js";
import type * as github_pipelineBuilder from "../github/pipelineBuilder.js";
import type * as github_pipelineHelpers from "../github/pipelineHelpers.js";
import type * as github_prActions from "../github/prActions.js";
import type * as github_prReads from "../github/prReads.js";
import type * as github_project from "../github/project.js";
import type * as github_projection from "../github/projection.js";
import type * as github_prune from "../github/prune.js";
import type * as github_queueDecision from "../github/queueDecision.js";
import type * as github_queueMappers from "../github/queueMappers.js";
import type * as github_readModel from "../github/readModel.js";
import type * as github_reader from "../github/reader.js";
import type * as github_reconcile from "../github/reconcile.js";
import type * as github_refresh from "../github/refresh.js";
import type * as github_refs from "../github/refs.js";
import type * as github_reviewQueue from "../github/reviewQueue.js";
import type * as github_reviews from "../github/reviews.js";
import type * as github_rows from "../github/rows.js";
import type * as github_searchActions from "../github/searchActions.js";
import type * as github_symbolIndex from "../github/symbolIndex.js";
import type * as github_tokens from "../github/tokens.js";
import type * as github_userToken from "../github/userToken.js";
import type * as github_validators from "../github/validators.js";
import type * as github_verifyWebhook from "../github/verifyWebhook.js";
import type * as github_viewer from "../github/viewer.js";
import type * as github_webhook from "../github/webhook.js";
import type * as github_workbench from "../github/workbench.js";
import type * as github_workbenchMappers from "../github/workbenchMappers.js";
import type * as github_workbenchTypes from "../github/workbenchTypes.js";
import type * as github_writeQueue from "../github/writeQueue.js";
import type * as github_writer from "../github/writer.js";
import type * as github_writes from "../github/writes.js";
import type * as http from "../http.js";
import type * as spikes_effectSpike from "../spikes/effectSpike.js";
import type * as spikes_githubAppSpike from "../spikes/githubAppSpike.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  crons: typeof crons;
  "github/appAuth": typeof github_appAuth;
  "github/appJwt": typeof github_appJwt;
  "github/conversationWrite": typeof github_conversationWrite;
  "github/domain": typeof github_domain;
  "github/gate": typeof github_gate;
  "github/githubClient": typeof github_githubClient;
  "github/githubErrors": typeof github_githubErrors;
  "github/ingest": typeof github_ingest;
  "github/installationToken": typeof github_installationToken;
  "github/installations": typeof github_installations;
  "github/materialize": typeof github_materialize;
  "github/pipelineBuilder": typeof github_pipelineBuilder;
  "github/pipelineHelpers": typeof github_pipelineHelpers;
  "github/prActions": typeof github_prActions;
  "github/prReads": typeof github_prReads;
  "github/project": typeof github_project;
  "github/projection": typeof github_projection;
  "github/prune": typeof github_prune;
  "github/queueDecision": typeof github_queueDecision;
  "github/queueMappers": typeof github_queueMappers;
  "github/readModel": typeof github_readModel;
  "github/reader": typeof github_reader;
  "github/reconcile": typeof github_reconcile;
  "github/refresh": typeof github_refresh;
  "github/refs": typeof github_refs;
  "github/reviewQueue": typeof github_reviewQueue;
  "github/reviews": typeof github_reviews;
  "github/rows": typeof github_rows;
  "github/searchActions": typeof github_searchActions;
  "github/symbolIndex": typeof github_symbolIndex;
  "github/tokens": typeof github_tokens;
  "github/userToken": typeof github_userToken;
  "github/validators": typeof github_validators;
  "github/verifyWebhook": typeof github_verifyWebhook;
  "github/viewer": typeof github_viewer;
  "github/webhook": typeof github_webhook;
  "github/workbench": typeof github_workbench;
  "github/workbenchMappers": typeof github_workbenchMappers;
  "github/workbenchTypes": typeof github_workbenchTypes;
  "github/writeQueue": typeof github_writeQueue;
  "github/writer": typeof github_writer;
  "github/writes": typeof github_writes;
  http: typeof http;
  "spikes/effectSpike": typeof spikes_effectSpike;
  "spikes/githubAppSpike": typeof spikes_githubAppSpike;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("../betterAuth/_generated/component.js").ComponentApi<"betterAuth">;
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
};
