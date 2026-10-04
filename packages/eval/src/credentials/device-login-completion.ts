import type { Actor } from "@sphynx/schema/domain/actor";
import type { StartDeviceAuth } from "@sphynx/schema/domain/credentials";
import { Effect } from "effect";
import type { CredentialAuthAttemptRepositoryShape } from "./auth-attempt-repository";
import { sealAttemptState } from "./auth-attempt-state";
import type { CredentialCipherShape } from "./cipher";
import type { CodexLogin } from "./codex-login";
import type { SubscriptionsShape } from "./subscriptions";

interface Completion {
  readonly attempts: CredentialAuthAttemptRepositoryShape;
  readonly cipher: CredentialCipherShape;
  readonly subscriptions: SubscriptionsShape;
}

export const completeDeviceLogin = (
  { attempts, cipher, subscriptions }: Completion,
  login: CodexLogin,
  actor: Actor,
  attemptId: string,
  input: StartDeviceAuth
) =>
  login.authJson.pipe(
    Effect.flatMap((authJson) =>
      subscriptions.addChatGpt(actor, authJson, input.scope)
    ),
    Effect.flatMap((subscription) =>
      sealAttemptState(cipher, actor.organizationId, attemptId, {
        subscriptionId: subscription.id,
      }).pipe(
        Effect.flatMap((state) =>
          attempts.finish(attemptId, {
            sealedState: state,
            status: "complete",
          })
        )
      )
    ),
    Effect.catchAll(() =>
      attempts.finish(attemptId, { status: "failed" }).pipe(Effect.ignore)
    ),
    Effect.ensuring(login.cleanup)
  );
