import type { Actor } from "@sphynx/schema/domain/actor";
import { authorIdOf } from "@sphynx/schema/domain/actor";
import type {
  EvalVariantRequest,
  StartBatchRequest,
} from "@sphynx/schema/domain/eval-definition";
import {
  MAX_ORGANIZATION_RUNS_IN_FLIGHT,
  MAX_RUN_TRIALS,
  trialsRequested,
} from "@sphynx/schema/domain/eval-quota";
import type { StartedBatch } from "@sphynx/schema/domain/evals";
import type { IdempotencyKey } from "@sphynx/schema/public/runner-api";
import { Effect, Either, Option } from "effect";
import { variablesRef } from "../credentials/credential-ref";
import { modelAccessFor } from "../credentials/model-key";
import { CredentialResolver } from "../credentials/resolver";
import { bindCredentials } from "../credentials/variants";
import { caseDefinitionOf } from "../domain/case-definition";
import { definitionHashOf } from "../domain/case-identity";
import { StartRefused } from "../domain/errors";
import { profileOfRequest } from "../domain/harness-profile";
import { profileVersionOf } from "../domain/profile-identity";
import { startRequestHashOf } from "../domain/start-request-hash";
import { userHarness } from "../domain/suite-harnesses";
import { userModel, userModelOf, userModelRoute } from "../domain/variant";
import { variablesFor } from "../environment/variable-credentials";
import { ownerOf } from "../environment/variable-repository";
import {
  BatchRepository,
  type StartKey,
} from "../repositories/batch-repository";
import { CatalogRepository } from "../repositories/catalog-repository";
import { HarnessProfileRepository } from "../repositories/harness-profile-repository";
import { startedBatchQuery } from "../repositories/started-batch-query";
import { HarnessVersions } from "../services/harness-versions";
import { refuseWhenBusy, tooBusy } from "./in-flight";
import type { Launch, Launched } from "./launch";

const variantKey = (variant: EvalVariantRequest) =>
  [
    variant.harness,
    variant.model,
    variant.sandbox,
    variant.profile?.name ?? "",
  ].join("\u0000");

const refuseUnsetVariables = (actor: Actor, request: StartBatchRequest) =>
  Effect.gen(function* () {
    for (const names of request.variants.flatMap((variant) =>
      variant.profile?.variables?.length ? [variant.profile.variables] : []
    )) {
      const named = yield* (yield* CredentialResolver)
        .variables({
          credentialRef: variablesRef(ownerOf(actor)),
          names,
          organizationId: actor.organizationId,
        })
        .pipe(Effect.either);
      if (Either.isLeft(named) && named.left.code === "internal") {
        return yield* new StartRefused({
          reason: "The environment could not be read. Try again.",
          retryable: true,
        });
      }
      if (Either.isLeft(named)) {
        return yield* new StartRefused({
          reason: `A profile names variables that are not set. ${named.left.message}.`,
          retryable: false,
        });
      }
    }
  });

const admit = (actor: Actor, request: StartBatchRequest) =>
  Effect.gen(function* () {
    const keys = request.variants.map(variantKey);
    if (new Set(keys).size !== keys.length) {
      return yield* new StartRefused({
        reason: "Each variant must be different.",
        retryable: false,
      });
    }

    const requested = trialsRequested({
      cases: request.cases.length,
      trials: request.trials,
      variants: request.variants.length,
    });
    if (requested > MAX_RUN_TRIALS) {
      return yield* new StartRefused({
        reason: `A batch may contain at most ${MAX_RUN_TRIALS} trials, and this one asks for ${requested}.`,
        retryable: false,
      });
    }

    for (const harness of new Set(request.cases.flatMap(userHarness))) {
      const credential = yield* (yield* CredentialResolver)
        .resolve({ actor, integrationId: harness })
        .pipe(Effect.either);
      if (Either.isLeft(credential)) {
        return yield* new StartRefused({
          reason: `A case asks ${harness} to play the human. ${credential.left.message}.`,
          retryable: false,
        });
      }
    }
    if (!request.local) {
      yield* refuseUnsetVariables(actor, request);
    }
    if (
      request.cases.some(
        (subject) =>
          subject.user?.kind === "simulated" &&
          userHarness(subject).length === 0
      )
    ) {
      const { providerId } = userModelRoute(yield* userModel);
      const access = yield* modelAccessFor(
        yield* CredentialResolver,
        actor.organizationId,
        providerId
      );
      if (Option.isNone(access)) {
        const names = variablesFor(providerId);
        return yield* new StartRefused({
          reason: `A case states a human, which needs a model to play them. Set ${names.length === 0 ? `the ${providerId} key` : names.join(" and ")} in Settings > Environment.`,
          retryable: false,
        });
      }
    }

    yield* refuseWhenBusy(actor.organizationId);
  });

export interface Start {
  readonly replayed: boolean;
  readonly started: StartedBatch;
}

export const makeStartBatch = (
  launch: (input: Launch) => Effect.Effect<Launched, unknown>
) =>
  Effect.gen(function* () {
    const catalog = yield* CatalogRepository;
    const credentials = yield* CredentialResolver;
    const profiles = yield* HarnessProfileRepository;
    const versions = yield* HarnessVersions;
    const batches = yield* BatchRepository;
    const startedWith = yield* startedBatchQuery;

    const earlier = (actor: Actor, keyed: StartKey | null) =>
      Effect.gen(function* () {
        if (keyed === null) {
          return Option.none<StartedBatch>();
        }
        const found = yield* startedWith(actor.organizationId, keyed.key).pipe(
          Effect.orDie
        );
        if (Option.isNone(found)) {
          return Option.none<StartedBatch>();
        }
        const { requestHash, started } = found.value;
        if (requestHash !== null && requestHash !== keyed.requestHash) {
          return yield* new StartRefused({
            reason:
              "This idempotency key already started a different run. Send a new key to start this one.",
            retryable: false,
          });
        }
        return Option.some(started);
      });

    const replayRaced = (actor: Actor, keyed: StartKey | null) =>
      Effect.gen(function* () {
        const raced = yield* earlier(actor, keyed);
        if (Option.isNone(raced)) {
          return yield* Effect.dieMessage(
            "the start lost a race for its key, and no batch holds that key"
          );
        }
        return { replayed: true, started: raced.value } satisfies Start;
      });

    const admitted = (actor: Actor, request: StartBatchRequest) =>
      admit(actor, request).pipe(
        Effect.provideService(CredentialResolver, credentials),
        Effect.provideService(BatchRepository, batches)
      );

    return (
      actor: Actor,
      request: StartBatchRequest,
      idempotencyKey: IdempotencyKey | null
    ) =>
      Effect.gen(function* () {
        const keyed =
          idempotencyKey === null
            ? null
            : {
                key: idempotencyKey,
                requestHash: startRequestHashOf(request),
              };
        const replay = yield* earlier(actor, keyed);
        if (Option.isSome(replay)) {
          return { replayed: true, started: replay.value } satisfies Start;
        }

        yield* admitted(actor, request);

        const conductedBy = yield* userModel;
        const bound = yield* bindCredentials(
          credentials,
          actor,
          request.variants
        );
        const harnessVersions = yield* Effect.forEach(
          request.variants,
          (variant) => versions.version(variant.harness)
        );
        const profileRows = yield* Effect.forEach(
          request.variants,
          (variant) => {
            const profile = profileOfRequest(variant.profile);
            return profile === null
              ? Effect.succeed(null)
              : profiles
                  .insertIfAbsent({
                    ...profile,
                    base: variant.harness,
                    organizationId: actor.organizationId,
                    version: profileVersionOf(profile),
                  })
                  .pipe(Effect.orDie);
          },
          { concurrency: 4 }
        );

        const cases = request.cases.map((subject) => {
          const definition = caseDefinitionOf(request.suite, subject);
          return {
            ...definition,
            definitionHash: definitionHashOf(definition),
            id: subject.id,
            name: subject.name,
            tags: subject.tags,
            variants: request.variants.map((variant) => ({
              harness: variant.harness,
              model: variant.model,
              profile: variant.profile?.name ?? null,
              sandbox: variant.sandbox,
              userModel: userModelOf(subject.user, conductedBy),
            })),
          };
        });

        const registered = yield* catalog
          .register({
            cases,
            createdBy: authorIdOf(actor),
            organizationId: actor.organizationId,
            suite: request.suite,
          })
          .pipe(Effect.orDie);

        const slots = registered.flatMap((subject, caseIndex) =>
          subject.variantInternalIds.map((variantInternalId, variantIndex) => ({
            caseId: request.cases[caseIndex]?.id ?? "",
            run: {
              ...(bound[variantIndex] ?? {
                harnessCredentialRef: null,
                harnessCredentialRevision: null,
                sandboxCredentialRef: null,
                sandboxCredentialRevision: null,
              }),
              caseVersionInternalId: subject.caseVersionInternalId,
              harnessVersion: harnessVersions[variantIndex] ?? "unknown",
              profileInternalId: profileRows[variantIndex]?.internalId ?? null,
              trialCount: request.trials,
              variantInternalId,
            },
          }))
        );

        const launched = yield* launch({
          checksIn: request.checksIn,
          idempotency: keyed,
          limit: MAX_ORGANIZATION_RUNS_IN_FLIGHT,
          local: request.local,
          organizationId: actor.organizationId,
          runs: slots.map((slot) => slot.run),
          startedBy: authorIdOf(actor),
          trigger: request.trigger ?? { source: "api" },
        }).pipe(Effect.orDie);

        if (launched.kind === "overLimit") {
          return yield* tooBusy(launched.inFlight);
        }

        if (launched.kind === "keyTaken") {
          return yield* replayRaced(actor, keyed);
        }

        return {
          replayed: false,
          started: {
            id: launched.internalId,
            runs: slots.map((slot, index) => ({
              caseId: slot.caseId,
              id: launched.runInternalIds[index] ?? "",
              variantId: slot.run.variantInternalId,
            })),
          },
        } satisfies Start;
      }).pipe(
        Effect.withSpan("Batches.start", {
          attributes: {
            cases: request.cases.length,
            keyed: idempotencyKey !== null,
            suite: request.suite.id,
            trials: request.trials,
            variants: request.variants.length,
          },
        }),
        Effect.annotateLogs({ organizationId: actor.organizationId })
      );
  });
