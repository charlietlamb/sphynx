import { Database } from "@sphynx/db/client";
import { head } from "@sphynx/db/query";
import { credentialConnection } from "@sphynx/db/schema/credentials/connections";
import type { Actor } from "@sphynx/schema/domain/actor";
import { and, eq } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import { tryStore } from "../repositories/query";
import {
  insertClaimingDefault,
  type NewConnection,
} from "./connection-default";
import {
  selectActive,
  selectAllVisible,
  selectBound,
  selectVisible,
} from "./connection-lookup";
import type { ConnectionRow } from "./connection-row";
import { visibleTo } from "./connection-scope";
import {
  type CredentialError,
  connectionNotFound,
  storeUnavailable,
} from "./errors";

export interface CredentialConnectionRepositoryShape {
  readonly find: (
    actor: Actor,
    id: string
  ) => Effect.Effect<ConnectionRow, CredentialError>;
  readonly findActive: (
    actor: Actor,
    integrationId: string,
    connectionId: string | undefined
  ) => Effect.Effect<ConnectionRow, CredentialError>;
  readonly findBound: (
    organizationId: string,
    connectionId: string
  ) => Effect.Effect<ConnectionRow, CredentialError>;
  readonly insert: (
    actor: Actor,
    row: NewConnection
  ) => Effect.Effect<ConnectionRow, CredentialError>;
  readonly list: (
    actor: Actor
  ) => Effect.Effect<readonly ConnectionRow[], CredentialError>;
  readonly remove: (
    actor: Actor,
    id: string
  ) => Effect.Effect<void, CredentialError>;
  readonly reseal: (
    organizationId: string,
    id: string,
    sealedPayload: string,
    now: Date
  ) => Effect.Effect<void, CredentialError>;
  readonly touch: (
    organizationId: string,
    id: string,
    now: Date
  ) => Effect.Effect<void, CredentialError>;
}

export class CredentialConnectionRepository extends Context.Tag(
  "@sphynx/eval/CredentialConnectionRepository"
)<CredentialConnectionRepository, CredentialConnectionRepositoryShape>() {}

const firstOrNotFound = (rows: readonly ConnectionRow[]) =>
  Effect.mapError(head(rows), connectionNotFound);

const stored = <A>(method: string, run: () => Promise<A>) =>
  tryStore(`CredentialConnectionRepository.${method}`, run).pipe(
    Effect.mapError(storeUnavailable),
    Effect.withSpan(`CredentialConnectionRepository.${method}`)
  );

export const CredentialConnectionRepositoryLive = Layer.effect(
  CredentialConnectionRepository,
  Effect.gen(function* () {
    const db = yield* Database;

    return CredentialConnectionRepository.of({
      find: (actor, id) =>
        stored("find", () => selectVisible(db, actor, id)).pipe(
          Effect.flatMap(firstOrNotFound)
        ),
      findActive: (actor, integrationId, connectionId) =>
        stored("findActive", () =>
          selectActive(db, actor, integrationId, connectionId)
        ).pipe(Effect.flatMap(firstOrNotFound)),
      findBound: (organizationId, connectionId) =>
        stored("findBound", () =>
          selectBound(db, organizationId, connectionId)
        ).pipe(Effect.flatMap(firstOrNotFound)),
      insert: (actor, row) =>
        stored("insert", () => insertClaimingDefault(db, actor, row)).pipe(
          Effect.flatMap(firstOrNotFound)
        ),
      list: (actor) => stored("list", () => selectAllVisible(db, actor)),
      remove: (actor, id) =>
        stored("remove", () =>
          db
            .delete(credentialConnection)
            .where(
              and(
                visibleTo(actor.organizationId, actor.id),
                eq(credentialConnection.id, id)
              )
            )
            .returning({ id: credentialConnection.id })
        ).pipe(
          Effect.flatMap((rows) =>
            rows.length === 0 ? Effect.fail(connectionNotFound()) : Effect.void
          )
        ),
      reseal: (organizationId, id, sealedPayload, now) =>
        stored("reseal", () =>
          db
            .update(credentialConnection)
            .set({ sealedPayload, updatedAt: now })
            .where(
              and(
                eq(credentialConnection.organizationId, organizationId),
                eq(credentialConnection.id, id)
              )
            )
        ).pipe(Effect.asVoid),
      touch: (organizationId, id, now) =>
        stored("touch", () =>
          db
            .update(credentialConnection)
            .set({ lastUsedAt: now })
            .where(
              and(
                eq(credentialConnection.organizationId, organizationId),
                eq(credentialConnection.id, id)
              )
            )
        ).pipe(Effect.asVoid),
    });
  })
);
