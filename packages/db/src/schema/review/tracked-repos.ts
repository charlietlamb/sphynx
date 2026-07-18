import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "../auth/users";

export const trackedRepo = pgTable(
  "tracked_repo",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    owner: text("owner").notNull(),
    repo: text("repo").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("tracked_repo_user_repo_idx").on(
      table.userId,
      table.owner,
      table.repo
    ),
  ]
);
