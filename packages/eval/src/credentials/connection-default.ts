import type { Db } from "@sphynx/db/query";
import { credentialConnection } from "@sphynx/db/schema/credentials/connections";
import { and, desc, eq } from "drizzle-orm";
import { defaultScope, visibleTo } from "./connection-scope";

interface Owner {
  readonly id: string;
  readonly organizationId: string;
}

export type NewConnection = Omit<
  typeof credentialConnection.$inferInsert,
  "isDefault"
>;

export const insertClaimingDefault = (
  db: Db,
  actor: Owner,
  row: NewConnection
) =>
  db.transaction(async (tx) => {
    const scope = defaultScope(
      actor.organizationId,
      actor.id,
      row.integrationId,
      row.scope
    );
    const [held] = await tx
      .select({ status: credentialConnection.status })
      .from(credentialConnection)
      .where(and(scope, eq(credentialConnection.isDefault, true)))
      .limit(1);
    const isDefault = held?.status !== "active";

    if (isDefault && held !== undefined) {
      await tx
        .update(credentialConnection)
        .set({ isDefault: false })
        .where(and(scope, eq(credentialConnection.isDefault, true)));
    }
    return tx
      .insert(credentialConnection)
      .values({ ...row, isDefault })
      .returning();
  });

export const removeHandingOnDefault = (db: Db, actor: Owner, id: string) =>
  db.transaction(async (tx) => {
    const [removed] = await tx
      .delete(credentialConnection)
      .where(
        and(
          visibleTo(actor.organizationId, actor.id),
          eq(credentialConnection.id, id)
        )
      )
      .returning();

    if (removed?.isDefault !== true) {
      return removed;
    }

    const scope = defaultScope(
      removed.organizationId,
      removed.ownerUserId ?? actor.id,
      removed.integrationId,
      removed.scope
    );
    const [heir] = await tx
      .select({ id: credentialConnection.id })
      .from(credentialConnection)
      .where(and(scope, eq(credentialConnection.status, "active")))
      .orderBy(desc(credentialConnection.createdAt))
      .limit(1);

    if (heir !== undefined) {
      await tx
        .update(credentialConnection)
        .set({ isDefault: true })
        .where(eq(credentialConnection.id, heir.id));
    }

    return removed;
  });
