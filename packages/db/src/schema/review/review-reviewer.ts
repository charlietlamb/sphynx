import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { reviewPull } from "./review-pull";

export const reviewReviewer = pgTable(
  "review_reviewer",
  {
    pullId: text("pull_id")
      .notNull()
      .references(() => reviewPull.id, { onDelete: "cascade" }),
    login: text("login").notNull(),
    kind: text("kind").notNull(),
    avatarUrl: text("avatar_url"),
    state: text("state").notNull(),
    score: text("score"),
    submittedAt: timestamp("submitted_at"),
  },
  (table) => [primaryKey({ columns: [table.pullId, table.login] })]
);
