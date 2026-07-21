import {
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const pullHead = pgTable(
  "pull_head",
  {
    installationId: integer("installation_id").notNull(),
    owner: text("owner").notNull(),
    repo: text("repo").notNull(),
    number: integer("number").notNull(),
    headSha: text("head_sha").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.owner, table.repo, table.number] }),
    index("pull_head_installation_idx").on(table.installationId),
    index("pull_head_head_sha_idx").on(table.owner, table.repo, table.headSha),
  ]
);
