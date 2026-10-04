import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform";
import { Schema } from "effect";
import { CredentialScope, Subscription } from "../domain/credentials";
import {
  EnvironmentVariable,
  NewVariable,
  VARIABLE_LIMITS,
  VariableName,
} from "../domain/environment";
import { BadRequest, Forbidden, NotFound } from "../domain/errors";
import { ApiKeyAuthentication } from "./authentication";
import { Repeatable } from "./repeatable";

const ListEnvironmentRequest = Schema.Struct({}).annotations({
  description: "List the variables and subscriptions this organization has.",
  identifier: "ListEnvironmentRequest",
});

const EnvironmentListing = Schema.Struct({
  subscriptions: Schema.Array(Subscription),
  variables: Schema.Array(EnvironmentVariable),
}).annotations({ identifier: "EnvironmentListing" });

const SetVariablesRequest = Schema.Struct({
  scope: Schema.optionalWith(CredentialScope, {
    default: () => "organization" as const,
  }),
  variables: Schema.Array(NewVariable).pipe(
    Schema.minItems(1),
    Schema.maxItems(VARIABLE_LIMITS.perRequest)
  ),
}).annotations({
  description:
    "Set variables. A name that already exists is replaced. Values are encrypted on arrival and never read back.",
  identifier: "SetVariablesRequest",
});

const RemoveVariableRequest = Schema.Struct({
  name: VariableName,
  scope: Schema.optionalWith(CredentialScope, {
    default: () => "organization" as const,
  }),
}).annotations({
  description: "Remove a variable by its name.",
  identifier: "RemoveVariableRequest",
});

export class PublicEnvironmentGroup extends HttpApiGroup.make("environment")
  .add(
    HttpApiEndpoint.post("list", "/environment.list")
      .annotate(Repeatable, true)
      .setPayload(ListEnvironmentRequest)
      .addSuccess(EnvironmentListing)
      .annotate(OpenApi.Summary, "List variables and subscriptions")
      .annotate(
        OpenApi.Description,
        "Secret values are never returned, only a preview."
      )
  )
  .add(
    HttpApiEndpoint.post("set", "/environment.set")
      .setPayload(SetVariablesRequest)
      .addSuccess(Schema.Array(EnvironmentVariable))
      .annotate(OpenApi.Summary, "Set variables")
  )
  .add(
    HttpApiEndpoint.post("remove", "/environment.remove")
      .setPayload(RemoveVariableRequest)
      .addSuccess(Schema.Void)
      .annotate(OpenApi.Summary, "Remove a variable")
  )
  .middleware(ApiKeyAuthentication)
  .addError(BadRequest)
  .addError(Forbidden)
  .addError(NotFound)
  .annotate(OpenApi.Title, "Environment")
  .annotate(
    OpenApi.Description,
    "The keys and subscriptions eval runs use. Known names such as ANTHROPIC_API_KEY run the matching harness, judge or sandbox; other names reach a run when its profile names them."
  ) {}
