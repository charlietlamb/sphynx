import { Schema } from "effect";

export const CredentialScope = Schema.Literal("organization", "personal");
export type CredentialScope = typeof CredentialScope.Type;

export const CredentialStatus = Schema.Literal("active", "invalid");
export type CredentialStatus = typeof CredentialStatus.Type;

export const CredentialValues = Schema.Record({
  key: Schema.String,
  value: Schema.String,
});
export type CredentialValues = typeof CredentialValues.Type;

export const ResolvedCredential = Schema.Struct({
  authMethodId: Schema.String,
  connectionId: Schema.String,
  integrationId: Schema.String,
  revision: Schema.Int,
  values: CredentialValues,
});
export type ResolvedCredential = typeof ResolvedCredential.Type;

export const CredentialBindings = Schema.Struct({
  harnessRef: Schema.optional(Schema.String),
  sandboxRef: Schema.optional(Schema.String),
});
export type CredentialBindings = typeof CredentialBindings.Type;

export const SubscriptionPlan = Schema.Literal("chatgpt", "opencode", "pi");
export type SubscriptionPlan = typeof SubscriptionPlan.Type;

export const Subscription = Schema.Struct({
  createdAt: Schema.DateTimeUtc,
  id: Schema.String,
  isDefault: Schema.Boolean,
  lastUsedAt: Schema.NullOr(Schema.DateTimeUtc),
  plan: SubscriptionPlan,
  renews: Schema.Boolean,
  scope: CredentialScope,
  status: CredentialStatus,
}).annotations({
  description: "A plan an agent signs in with. Its token is never returned.",
  identifier: "Subscription",
});
export type Subscription = typeof Subscription.Type;

export const AddSubscription = Schema.Struct({
  authJson: Schema.String.pipe(Schema.minLength(2), Schema.maxLength(65_536)),
  plan: Schema.Literal("opencode", "pi"),
  scope: CredentialScope,
});
export type AddSubscription = typeof AddSubscription.Type;

export const StartDeviceAuth = Schema.Struct({
  scope: CredentialScope,
});
export type StartDeviceAuth = typeof StartDeviceAuth.Type;

export const DeviceAuthChallenge = Schema.Struct({
  attemptId: Schema.String,
  code: Schema.String,
  expiresAt: Schema.DateTimeUtc,
  verificationUrl: Schema.String,
});
export type DeviceAuthChallenge = typeof DeviceAuthChallenge.Type;

export const DeviceAuthStatus = Schema.Struct({
  subscriptionId: Schema.NullOr(Schema.String),
  status: Schema.Literal("pending", "complete", "failed", "expired"),
});
export type DeviceAuthStatus = typeof DeviceAuthStatus.Type;
