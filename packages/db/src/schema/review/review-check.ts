import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { reviewPull } from "./review-pull";

export const reviewCheck = pgTable(
  "review_check",
  {
    pullId: text("pull_id")
      .notNull()
      .references(() => reviewPull.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    bucket: text("bucket").notNull(),
    detailsUrl: text("details_url"),
    completedAt: timestamp("completed_at"),
  },
  (table) => [primaryKey({ columns: [table.pullId, table.name] })]
);
