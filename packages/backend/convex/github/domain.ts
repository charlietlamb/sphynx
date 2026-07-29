/**
 * The read-model domain types come from the shared `@sphynx/schema/read-model`
 * contract (a type-only import, so nothing from that package enters the Convex
 * bundle). The local `validators.ts` holds the matching Convex validators — the
 * values Convex needs for `defineTable`/args/returns — and asserts at compile
 * time that they stay structurally identical to these types.
 */
export type {
  CiState,
  Decision,
  FailingCheck,
  Pipeline,
  PromotedPull,
  PullState,
  QueuePull,
  RepoFlow,
  ReviewerVerdict,
  SourceKind,
  StageGap,
  ThreadPreview,
} from "@sphynx/schema/read-model";
