import type { Actor } from "@sphynx/schema/domain/actor";
import { keptOnServer } from "@sphynx/schema/domain/known-variables";
import { Clock, Effect, Layer, Redacted } from "effect";
import { namedValues, revisionOf, valuesOf } from "../environment/named-values";
import {
  credentialFromVariables,
  SUBSCRIPTION_INTEGRATIONS,
  variablesFor,
} from "../environment/variable-credentials";
import {
  ownerOf,
  type VariableOwner,
  VariableRepository,
  VariableRepositoryLive,
} from "../environment/variable-repository";
import { CredentialCipher } from "./cipher";
import { openValues, sealValues } from "./connection-payload";
import {
  CredentialConnectionRepository,
  CredentialConnectionRepositoryLive,
} from "./connection-repository";
import type { ConnectionRow } from "./connection-row";
import { parseRef, variablesRef } from "./credential-ref";
import { CredentialError } from "./errors";
import { CredentialResolver } from "./resolver";

const missingVariables = (integrationId: string, names: readonly string[]) =>
  new CredentialError({
    code: "not-found",
    message:
      names.length === 0
        ? `Nothing is set for ${integrationId}`
        : `Set ${names.join(", ")} in Settings > Environment to run ${integrationId}`,
  });

export const CredentialResolverLive = Layer.effect(
  CredentialResolver,
  Effect.gen(function* () {
    const cipher = yield* CredentialCipher;
    const connections = yield* CredentialConnectionRepository;
    const variables = yield* VariableRepository;

    const openRow = (row: ConnectionRow) =>
      openValues(cipher, row).pipe(
        Effect.map((values) =>
          Redacted.make({
            authMethodId: row.authMethodId,
            connectionId: row.id,
            integrationId: row.integrationId,
            revision: row.revision,
            values: Redacted.value(values),
          })
        )
      );

    const touch = (organizationId: string) => (row: ConnectionRow) =>
      Clock.currentTimeMillis.pipe(
        Effect.flatMap((now) =>
          connections.touch(organizationId, row.id, new Date(now))
        ),
        Effect.ignore
      );

    const fromVariables = (owner: VariableOwner, integrationId: string) =>
      Effect.gen(function* () {
        const names = variablesFor(integrationId);
        const named = yield* namedValues(variables, cipher, owner, names);
        const credential = credentialFromVariables(
          integrationId,
          valuesOf(named)
        );
        if (credential === undefined) {
          return yield* missingVariables(
            integrationId,
            names.filter((name) => !named.has(name))
          );
        }
        return Redacted.make({
          authMethodId: credential.authMethodId,
          connectionId: variablesRef(owner),
          integrationId,
          revision: revisionOf(named),
          values: credential.values,
        });
      });

    const subscriptionOrVariables = (actor: Actor, integrationId: string) =>
      SUBSCRIPTION_INTEGRATIONS.has(integrationId)
        ? connections.findActive(actor, integrationId, undefined).pipe(
            Effect.tap(touch(actor.organizationId)),
            Effect.flatMap(openRow),
            Effect.catchIf(
              (error) =>
                error.code === "not-found" &&
                variablesFor(integrationId).length > 0,
              () => fromVariables(ownerOf(actor), integrationId)
            )
          )
        : fromVariables(ownerOf(actor), integrationId);

    const ownerOfRef = (organizationId: string, credentialRef: string) => {
      const ref = parseRef(credentialRef);
      return ref.kind === "variables"
        ? Effect.succeed<VariableOwner>({ organizationId, userId: ref.userId })
        : connections.findBound(organizationId, ref.connectionId).pipe(
            Effect.map(
              (row): VariableOwner => ({
                organizationId,
                userId: row.scope === "personal" ? row.ownerUserId : null,
              })
            )
          );
    };

    const fromRef = (
      actor: Actor,
      integrationId: string,
      credentialRef: string
    ) => {
      const ref = parseRef(credentialRef);
      return ref.kind === "connection"
        ? connections
            .findActive(actor, integrationId, ref.connectionId)
            .pipe(
              Effect.tap(touch(actor.organizationId)),
              Effect.flatMap(openRow)
            )
        : fromVariables(ownerOf(actor), integrationId);
    };

    return CredentialResolver.of({
      persist: (input) =>
        Effect.gen(function* () {
          const row = yield* connections.findBound(
            input.organizationId,
            input.connectionId
          );
          const sealedPayload = yield* sealValues(cipher, input.values, row);
          const now = yield* Clock.currentTimeMillis;
          yield* connections.reseal(
            input.organizationId,
            row.id,
            sealedPayload,
            new Date(now)
          );
        }).pipe(
          Effect.withSpan("CredentialResolver.persist"),
          Effect.annotateLogs({
            connectionId: input.connectionId,
            organizationId: input.organizationId,
          })
        ),
      resolve: (input) => {
        const resolved =
          input.credentialRef === undefined
            ? subscriptionOrVariables(input.actor, input.integrationId)
            : fromRef(input.actor, input.integrationId, input.credentialRef);
        return resolved.pipe(
          Effect.withSpan("CredentialResolver.resolve"),
          Effect.annotateLogs({
            integrationId: input.integrationId,
            organizationId: input.actor.organizationId,
          })
        );
      },
      resolveBound: (input) => {
        const ref = parseRef(input.credentialRef);
        const resolved =
          ref.kind === "connection"
            ? connections
                .findBound(input.organizationId, ref.connectionId)
                .pipe(Effect.flatMap(openRow))
            : fromVariables(
                { organizationId: input.organizationId, userId: ref.userId },
                input.integrationId
              );
        return resolved.pipe(
          Effect.withSpan("CredentialResolver.resolveBound"),
          Effect.annotateLogs({
            integrationId: input.integrationId,
            organizationId: input.organizationId,
          })
        );
      },
      variables: (input) =>
        Effect.gen(function* () {
          const withheld = input.names.filter(keptOnServer);
          if (withheld.length > 0) {
            return yield* new CredentialError({
              message: `${withheld.join(", ")} never reaches a profile`,
            });
          }
          const owner = yield* ownerOfRef(
            input.organizationId,
            input.credentialRef
          );
          const named = yield* namedValues(
            variables,
            cipher,
            owner,
            input.names
          );
          const missing = input.names.filter((name) => !named.has(name));
          if (missing.length > 0) {
            return yield* new CredentialError({
              code: "not-found",
              message: `Set ${missing.join(", ")} in Settings > Environment`,
            });
          }
          return Redacted.make(Object.fromEntries(valuesOf(named)));
        }).pipe(
          Effect.withSpan("CredentialResolver.variables"),
          Effect.annotateLogs({ organizationId: input.organizationId })
        ),
    });
  })
).pipe(
  Layer.provide(CredentialConnectionRepositoryLive),
  Layer.provide(VariableRepositoryLive)
);
