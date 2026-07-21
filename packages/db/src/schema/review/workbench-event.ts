import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const workbenchEvent = pgTable(
  "workbench_event",
  {
    id: text("id").primaryKey(),
    installationId: integer("installation_id").notNull(),
    owner: text("owner").notNull(),
    repo: text("repo").notNull(),
    kind: text("kind").notNull(),
    actor: text("actor"),
    pullNumber: integer("pull_number"),
    title: text("title"),
    detail: text("detail"),
    occurredAt: timestamp("occurred_at").notNull(),
  },
  (table) => [
    index("workbench_event_feed_idx").on(
      table.installationId,
      table.occurredAt.desc()
    ),
    index("workbench_event_repo_idx").on(
      table.installationId,
      table.owner,
      table.repo,
      table.occurredAt.desc()
    ),
  ]
);
