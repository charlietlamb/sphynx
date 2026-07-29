/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as github_domain from "../github/domain.js";
import type * as github_gate from "../github/gate.js";
import type * as github_queueDecision from "../github/queueDecision.js";
import type * as github_queueMappers from "../github/queueMappers.js";
import type * as github_rows from "../github/rows.js";
import type * as github_validators from "../github/validators.js";
import type * as github_writer from "../github/writer.js";
import type * as spikes_effectSpike from "../spikes/effectSpike.js";
import type * as spikes_githubAppSpike from "../spikes/githubAppSpike.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "github/domain": typeof github_domain;
  "github/gate": typeof github_gate;
  "github/queueDecision": typeof github_queueDecision;
  "github/queueMappers": typeof github_queueMappers;
  "github/rows": typeof github_rows;
  "github/validators": typeof github_validators;
  "github/writer": typeof github_writer;
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
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
};
