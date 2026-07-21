import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { reviewRepo } from "./review-repo";

export const reviewPull = pgTable(
  "review_pull",
  {
    id: text("id").primaryKey(),
    repoId: text("repo_id")
      .notNull()
      .references(() => reviewRepo.id, { onDelete: "cascade" }),
    installationId: integer("installation_id").notNull(),
    number: integer("number").notNull(),
    state: text("state").notNull(),
    title: text("title").notNull(),
    authorLogin: text("author_login"),
    authorAvatarUrl: text("author_avatar_url"),
    isDraft: boolean("is_draft").notNull().default(false),
    hasBody: boolean("has_body").notNull().default(false),
    baseRef: text("base_ref").notNull(),
    headRef: text("head_ref").notNull(),
    additions: integer("additions").notNull().default(0),
    deletions: integer("deletions").notNull().default(0),
    changedFiles: integer("changed_files").notNull().default(0),
    ciState: text("ci_state").notNull().default("none"),
    ciFailed: integer("ci_failed").notNull().default(0),
    ciPassed: integer("ci_passed").notNull().default(0),
    ciPending: integer("ci_pending").notNull().default(0),
    unresolvedThreads: integer("unresolved_threads").notNull().default(0),
    decision: text("decision").notNull(),
    blocker: text("blocker"),
    mergedAt: timestamp("merged_at"),
    ghUpdatedAt: timestamp("gh_updated_at").notNull(),
    fetchedAt: timestamp("fetched_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("review_pull_repo_number_idx").on(table.repoId, table.number),
    index("review_pull_open_idx")
      .on(table.installationId)
      .where(sql`${table.state} = 'open'`),
    index("review_pull_repo_idx").on(table.repoId),
  ]
);
