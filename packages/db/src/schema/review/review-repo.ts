import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const reviewRepo = pgTable(
  "review_repo",
  {
    id: text("id").primaryKey(),
    installationId: integer("installation_id").notNull(),
    owner: text("owner").notNull(),
    repo: text("repo").notNull(),
    defaultBranch: text("default_branch"),
    stages: text("stages").array().notNull().default([]),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("review_repo_owner_repo_idx").on(
      table.installationId,
      table.owner,
      table.repo
    ),
    index("review_repo_installation_idx").on(table.installationId),
  ]
);
