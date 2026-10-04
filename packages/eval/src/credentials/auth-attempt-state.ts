import { DeviceAuthStatus } from "@sphynx/schema/domain/credentials";
import { Effect, Redacted, Schema } from "effect";
import type { CredentialCipherShape } from "./cipher";
import { CredentialError } from "./errors";

const AttemptState = Schema.Struct({
  subscriptionId: Schema.NullOr(Schema.String),
});

type AttemptState = typeof AttemptState.Type;

const contextOf = (organizationId: string, attemptId: string) =>
  `${organizationId}\0${attemptId}\0codex-device`;

const invalidAttempt = () =>
  new CredentialError({
    code: "internal",
    message: "Login attempt is invalid",
  });

export const sealAttemptState = (
  cipher: CredentialCipherShape,
  organizationId: string,
  attemptId: string,
  state: AttemptState
) =>
  cipher.seal(
    Redacted.make(JSON.stringify(state)),
    contextOf(organizationId, attemptId)
  );

export const openAttemptState = (
  cipher: CredentialCipherShape,
  organizationId: string,
  attemptId: string,
  sealedState: string
) =>
  cipher
    .open(sealedState, contextOf(organizationId, attemptId))
    .pipe(
      Effect.flatMap((sealed) =>
        Schema.decodeUnknown(Schema.parseJson(AttemptState))(
          Redacted.value(sealed)
        ).pipe(Effect.mapError(invalidAttempt))
      )
    );

export const decodeAttemptStatus = (input: {
  readonly subscriptionId: string | null;
  readonly status: string;
}) =>
  Schema.decodeUnknown(DeviceAuthStatus)(input).pipe(
    Effect.mapError(invalidAttempt)
  );
