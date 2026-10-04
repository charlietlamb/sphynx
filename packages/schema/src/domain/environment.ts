import { Schema } from "effect";
import { CredentialScope } from "./credentials";

export const RESERVED_VARIABLE_PREFIX = "SPHYNX_";

export const VARIABLE_LIMITS = {
  perRequest: 100,
  valueChars: 32_768,
} as const;

const VariableValue = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(VARIABLE_LIMITS.valueChars)
);

export const VariableName = Schema.String.pipe(
  Schema.pattern(/^[A-Z_][A-Z0-9_]*$/, {
    message: () => "Use capital letters, digits and underscores",
  }),
  Schema.maxLength(128),
  Schema.filter((name) => !name.startsWith(RESERVED_VARIABLE_PREFIX), {
    message: () =>
      `Names starting with ${RESERVED_VARIABLE_PREFIX} are reserved`,
  })
);
export type VariableName = typeof VariableName.Type;

export const EnvironmentVariable = Schema.Struct({
  createdAt: Schema.DateTimeUtc,
  id: Schema.String,
  lastUsedAt: Schema.NullOr(Schema.DateTimeUtc),
  name: Schema.String,
  preview: Schema.String,
  revision: Schema.Int,
  scope: CredentialScope,
  secret: Schema.Boolean,
  updatedAt: Schema.DateTimeUtc,
}).annotations({
  description: "A variable that runs read. Secret values are never returned.",
  identifier: "EnvironmentVariable",
});
export type EnvironmentVariable = typeof EnvironmentVariable.Type;

export const NewVariable = Schema.Struct({
  name: VariableName,
  secret: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  value: VariableValue,
});
export type NewVariable = typeof NewVariable.Type;

export const AddVariables = Schema.Struct({
  scope: CredentialScope,
  variables: Schema.Array(NewVariable).pipe(
    Schema.minItems(1),
    Schema.maxItems(VARIABLE_LIMITS.perRequest)
  ),
});
export type AddVariables = typeof AddVariables.Type;

export const UpdateVariable = Schema.Struct({
  scope: Schema.optional(CredentialScope),
  secret: Schema.optional(Schema.Boolean),
  value: Schema.optional(VariableValue),
});
export type UpdateVariable = typeof UpdateVariable.Type;

const SECRET_WORDS = /KEY|TOKEN|SECRET|PASSWORD|PASS|AUTH|CREDENTIAL|PRIVATE/;
const PLAIN_ADDRESS =
  /^(?:https?:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*|[a-z0-9-]+(?:\.[a-z0-9-]+)+)(?::\d{2,5})?\/?$/i;

export const secretByDefault = (
  name: string,
  value: string,
  known: { readonly secret: boolean } | undefined
) =>
  known?.secret ??
  (SECRET_WORDS.test(name) || !PLAIN_ADDRESS.test(value.trim()));
