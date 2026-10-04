import { Database } from "@sphynx/db/client";
import { type Db, head, type Tx } from "@sphynx/db/query";
import { environmentVariable } from "@sphynx/db/schema/credentials/environment-variables";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import { CredentialError, storeUnavailable } from "../credentials/errors";
import { tryStore } from "../repositories/query";
import type { VariableRow } from "./variable-row";

export interface VariableOwner {
  readonly organizationId: string;
  readonly userId: string | null;
}

type NewVariableRow = typeof environmentVariable.$inferInsert;

interface VariableChange {
  readonly preview?: string;
  readonly scope?: "organization" | "personal";
  readonly sealedValue?: string;
  readonly secret?: boolean;
}

interface VariableBatch {
  readonly inserts: readonly NewVariableRow[];
  readonly replacements: readonly {
    readonly change: VariableChange;
    readonly id: string;
  }[];
}

export interface VariableRepositoryShape {
  readonly find: (
    owner: VariableOwner,
    id: string
  ) => Effect.Effect<VariableRow, CredentialError>;
  readonly list: (
    owner: VariableOwner
  ) => Effect.Effect<readonly VariableRow[], CredentialError>;
  readonly named: (
    owner: VariableOwner,
    names: readonly string[]
  ) => Effect.Effect<readonly VariableRow[], CredentialError>;
  readonly remove: (
    owner: VariableOwner,
    id: string
  ) => Effect.Effect<void, CredentialError>;
  readonly save: (
    owner: VariableOwner,
    batch: VariableBatch,
    now: Date
  ) => Effect.Effect<readonly VariableRow[], CredentialError>;
  readonly touch: (
    ids: readonly string[],
    now: Date
  ) => Effect.Effect<void, CredentialError>;
  readonly update: (
    owner: VariableOwner,
    id: string,
    change: VariableChange,
    now: Date
  ) => Effect.Effect<VariableRow, CredentialError>;
}

export class VariableRepository extends Context.Tag(
  "@sphynx/eval/VariableRepository"
)<VariableRepository, VariableRepositoryShape>() {}

const variableNotFound = () =>
  new CredentialError({ code: "not-found", message: "Variable not found" });

const visibleTo = (owner: VariableOwner) =>
  and(
    eq(environmentVariable.organizationId, owner.organizationId),
    owner.userId === null
      ? eq(environmentVariable.scope, "organization")
      : or(
          eq(environmentVariable.scope, "organization"),
          and(
            eq(environmentVariable.scope, "personal"),
            eq(environmentVariable.ownerUserId, owner.userId)
          )
        )
  );

const stored = <A>(method: string, run: () => Promise<A>) =>
  tryStore(`VariableRepository.${method}`, run).pipe(
    Effect.mapError(storeUnavailable),
    Effect.withSpan(`VariableRepository.${method}`)
  );

const firstOrNotFound = (rows: readonly VariableRow[]) =>
  Effect.mapError(head(rows), variableNotFound);

const updateRow = (
  db: Db | Tx,
  owner: VariableOwner,
  id: string,
  change: VariableChange,
  now: Date
) =>
  db
    .update(environmentVariable)
    .set({
      ...(change.sealedValue === undefined
        ? {}
        : {
            preview: change.preview,
            revision: sql`${environmentVariable.revision} + 1`,
            sealedValue: change.sealedValue,
          }),
      ...(change.secret === undefined
        ? {}
        : { preview: change.preview, secret: change.secret }),
      ...(change.scope === undefined
        ? {}
        : {
            ownerUserId: change.scope === "personal" ? owner.userId : null,
            scope: change.scope,
          }),
      updatedAt: now,
    })
    .where(and(visibleTo(owner), eq(environmentVariable.id, id)))
    .returning();

export const VariableRepositoryLive = Layer.effect(
  VariableRepository,
  Effect.gen(function* () {
    const db = yield* Database;

    return VariableRepository.of({
      find: (owner, id) =>
        stored("find", () =>
          db
            .select()
            .from(environmentVariable)
            .where(and(visibleTo(owner), eq(environmentVariable.id, id)))
        ).pipe(Effect.flatMap(firstOrNotFound)),
      list: (owner) =>
        stored("list", () =>
          db
            .select()
            .from(environmentVariable)
            .where(visibleTo(owner))
            .orderBy(
              asc(environmentVariable.name),
              asc(environmentVariable.scope)
            )
        ),
      named: (owner, names) =>
        names.length === 0
          ? Effect.succeed([])
          : stored("named", () =>
              db
                .select()
                .from(environmentVariable)
                .where(
                  and(
                    visibleTo(owner),
                    inArray(environmentVariable.name, [...names])
                  )
                )
            ),
      remove: (owner, id) =>
        stored("remove", () =>
          db
            .delete(environmentVariable)
            .where(and(visibleTo(owner), eq(environmentVariable.id, id)))
            .returning({ id: environmentVariable.id })
        ).pipe(
          Effect.flatMap((rows) =>
            rows.length === 0 ? Effect.fail(variableNotFound()) : Effect.void
          )
        ),
      save: (owner, batch, now) =>
        tryStore("VariableRepository.save", () =>
          db.transaction(async (tx) => {
            const replaced: VariableRow[] = [];
            for (const { change, id } of batch.replacements) {
              const [row] = await updateRow(tx, owner, id, change, now);
              if (row === undefined) {
                throw variableNotFound();
              }
              replaced.push(row);
            }
            const inserted =
              batch.inserts.length === 0
                ? []
                : await tx
                    .insert(environmentVariable)
                    .values([...batch.inserts])
                    .returning();
            return [...replaced, ...inserted];
          })
        ).pipe(
          Effect.mapError(({ cause }) =>
            cause instanceof CredentialError ? cause : storeUnavailable()
          ),
          Effect.withSpan("VariableRepository.save")
        ),
      touch: (ids, now) =>
        ids.length === 0
          ? Effect.void
          : stored("touch", () =>
              db
                .update(environmentVariable)
                .set({ lastUsedAt: now })
                .where(inArray(environmentVariable.id, [...ids]))
            ).pipe(Effect.asVoid),
      update: (owner, id, change, now) =>
        stored("update", () => updateRow(db, owner, id, change, now)).pipe(
          Effect.flatMap(firstOrNotFound)
        ),
    });
  })
);

export const ownerOf = (actor: {
  readonly id: string;
  readonly isUser: boolean;
  readonly organizationId: string;
}): VariableOwner => ({
  organizationId: actor.organizationId,
  userId: actor.isUser ? actor.id : null,
});
