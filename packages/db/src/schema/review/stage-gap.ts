import {
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { reviewRepo } from "./review-repo";

export const stageGap = pgTable(
  "stage_gap",
  {
    repoId: text("repo_id")
      .notNull()
      .references(() => reviewRepo.id, { onDelete: "cascade" }),
    installationId: integer("installation_id").notNull(),
    fromStage: text("from_stage").notNull(),
    toStage: text("to_stage").notNull(),
    aheadBy: integer("ahead_by").notNull().default(0),
    directCommits: integer("direct_commits").notNull().default(0),
    promotionPull: integer("promotion_pull"),
    computedAt: timestamp("computed_at").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.repoId, table.fromStage, table.toStage],
    }),
    index("stage_gap_installation_idx").on(table.installationId),
  ]
);

export const stageGapPull = pgTable(
  "stage_gap_pull",
  {
    id: serial("id").primaryKey(),
    repoId: text("repo_id").notNull(),
    fromStage: text("from_stage").notNull(),
    toStage: text("to_stage").notNull(),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    authorLogin: text("author_login"),
    authorAvatarUrl: text("author_avatar_url"),
    mergedAt: timestamp("merged_at"),
  },
  (table) => [
    index("stage_gap_pull_gap_idx").on(
      table.repoId,
      table.fromStage,
      table.toStage
    ),
  ]
);
