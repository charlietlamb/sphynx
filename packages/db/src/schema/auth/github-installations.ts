import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization } from "./organizations";

/**
 * A GitHub App installation Sphynx can act through.
 *
 * `organizationId` links an installation to a Sphynx organization so teammates
 * share one installation — and therefore one cache entry and one rate-limit
 * budget. It stays null until an installation is claimed by an org.
 */
export const githubInstallation = pgTable(
  "github_installation",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    installationId: integer("installation_id").notNull(),
    accountLogin: text("account_login").notNull(),
    accountType: text("account_type").notNull(),
    avatarUrl: text("avatar_url"),
    repositorySelection: text("repository_selection").notNull(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("github_installation_installation_id_idx").on(
      table.installationId
    ),
    index("github_installation_organization_id_idx").on(table.organizationId),
  ]
);
