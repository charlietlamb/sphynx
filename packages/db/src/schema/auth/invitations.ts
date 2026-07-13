import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { organization } from "./organizations";
import { user } from "./users";

export const invitation = pgTable(
  "invitation",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role"),
    status: text("status").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    index("invitation_email_idx").on(table.email),
    index("invitation_organization_id_idx").on(table.organizationId),
  ]
);
