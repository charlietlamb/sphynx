/**
 * The review-queue wire shapes are defined once as Convex validators in
 * `./read-model` (the DB is their source of truth) and re-exported here as the
 * types the frontend consumes. Convex validates these at the query boundary, so
 * the client never re-decodes them — it imports the types only.
 */
export type {
  CiState,
  Decision,
  DiscoveredRepo,
  FailingCheck,
  Installation,
  Pipeline,
  PromotedPull,
  PullState,
  QueuePull,
  RepoFlow,
  ReviewerVerdict,
  StageGap,
  ThreadPreview,
} from "./read-model";
