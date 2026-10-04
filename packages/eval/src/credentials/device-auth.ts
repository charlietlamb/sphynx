import { IdGenerator } from "@sphynx/ids/id";
import type { Actor } from "@sphynx/schema/domain/actor";
import type {
  DeviceAuthChallenge,
  DeviceAuthStatus,
  StartDeviceAuth,
} from "@sphynx/schema/domain/credentials";
import { Clock, Config, Context, DateTime, Effect, Layer } from "effect";
import {
  CredentialAuthAttemptRepository,
  CredentialAuthAttemptRepositoryLive,
} from "./auth-attempt-repository";
import {
  decodeAttemptStatus,
  openAttemptState,
  sealAttemptState,
} from "./auth-attempt-state";
import { CredentialCipher } from "./cipher";
import { startCodexLogin } from "./codex-login";
import { completeDeviceLogin } from "./device-login-completion";
import { CredentialError } from "./errors";
import { Subscriptions } from "./subscriptions";

const DEVICE_TTL_MS = 15 * 60 * 1000;

export interface DeviceAuthShape {
  readonly start: (
    actor: Actor,
    input: StartDeviceAuth
  ) => Effect.Effect<DeviceAuthChallenge, CredentialError>;
  readonly status: (
    actor: Actor,
    id: string
  ) => Effect.Effect<DeviceAuthStatus, CredentialError>;
}

export class DeviceAuth extends Context.Tag("@sphynx/eval/DeviceAuth")<
  DeviceAuth,
  DeviceAuthShape
>() {}

export const DeviceAuthLive = Layer.effect(
  DeviceAuth,
  Effect.gen(function* () {
    const cipher = yield* CredentialCipher;
    const subscriptions = yield* Subscriptions;
    const attempts = yield* CredentialAuthAttemptRepository;
    const ids = yield* IdGenerator;
    const codex = yield* Config.string("CODEX_BIN_PATH").pipe(
      Config.withDefault("codex")
    );
    const path = yield* Config.string("PATH").pipe(
      Config.withDefault("/usr/local/bin:/usr/bin:/bin")
    );

    return DeviceAuth.of({
      start: (actor, input) =>
        Effect.gen(function* () {
          if (!actor.isUser) {
            return yield* Effect.fail(
              new CredentialError({
                message: "A ChatGPT login needs a signed-in member",
              })
            );
          }

          const attemptId = yield* ids.generate("credentialAuthAttempt");
          const login = yield* startCodexLogin(codex, path);
          return yield* Effect.gen(function* () {
            const challenge = yield* login.challenge;
            const now = yield* Clock.currentTimeMillis;
            const expiresAt = new Date(now + DEVICE_TTL_MS);
            const sealedState = yield* sealAttemptState(
              cipher,
              actor.organizationId,
              attemptId,
              { subscriptionId: null }
            );

            yield* attempts.create({
              authMethodId: "chatgpt",
              expiresAt,
              id: attemptId,
              integrationId: "codex",
              organizationId: actor.organizationId,
              sealedState,
              status: "pending",
              userId: actor.id,
            });
            yield* Effect.logInfo("device login started");

            yield* Effect.forkDaemon(
              completeDeviceLogin(
                { attempts, cipher, subscriptions },
                login,
                actor,
                attemptId,
                input
              )
            );

            return {
              attemptId,
              code: challenge.code,
              expiresAt: DateTime.unsafeMake(expiresAt.getTime()),
              verificationUrl: challenge.verificationUrl,
            };
          }).pipe(Effect.onError(() => login.cleanup));
        }).pipe(
          Effect.withSpan("DeviceAuth.start"),
          Effect.annotateLogs({ organizationId: actor.organizationId })
        ),
      status: (actor, id) =>
        attempts.find(actor, id).pipe(
          Effect.flatMap((row) =>
            Effect.gen(function* () {
              const state = yield* openAttemptState(
                cipher,
                actor.organizationId,
                row.id,
                row.sealedState
              );
              const now = yield* Clock.currentTimeMillis;
              const status =
                row.status === "pending" && row.expiresAt.getTime() < now
                  ? "expired"
                  : row.status;
              return yield* decodeAttemptStatus({
                subscriptionId: state.subscriptionId,
                status,
              });
            })
          ),
          Effect.withSpan("DeviceAuth.status"),
          Effect.annotateLogs({
            attemptId: id,
            organizationId: actor.organizationId,
          })
        ),
    });
  })
).pipe(Layer.provide(CredentialAuthAttemptRepositoryLive));
