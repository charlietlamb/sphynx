import type { Db } from "@sphynx/db/query";
import { credentialConnection } from "@sphynx/db/schema/credentials/connections";
import { and, eq } from "drizzle-orm";
import { defaultScope } from "./connection-scope";

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
