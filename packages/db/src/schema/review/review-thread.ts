import {
  bigint,
  boolean,
  pgTable,
  primaryKey,
  text,
} from "drizzle-orm/pg-core";
import { reviewPull } from "./review-pull";

export const reviewThread = pgTable(
  "review_thread",
  {
    pullId: text("pull_id")
      .notNull()
      .references(() => reviewPull.id, { onDelete: "cascade" }),
    threadId: text("thread_id").notNull(),
    isResolved: boolean("is_resolved").notNull().default(false),
    path: text("path"),
    rootCommentId: bigint("root_comment_id", { mode: "number" }),
    authorLogin: text("author_login"),
    authorAvatarUrl: text("author_avatar_url"),
    bodyPreview: text("body_preview").notNull(),
  },
  (table) => [primaryKey({ columns: [table.pullId, table.threadId] })]
);
