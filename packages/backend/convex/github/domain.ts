import type { Infer } from "convex/values";
import type {
  ciStateValidator,
  decisionValidator,
  failingCheckValidator,
  pipelineValidator,
  promotedPullValidator,
  pullStateValidator,
  queuePullValidator,
  repoFlowValidator,
  reviewerVerdictValidator,
  sourceKindValidator,
  stageGapValidator,
  threadPreviewValidator,
} from "./validators";

export type CiState = Infer<typeof ciStateValidator>;
export type Decision = Infer<typeof decisionValidator>;
export type PullState = Infer<typeof pullStateValidator>;
export type SourceKind = Infer<typeof sourceKindValidator>;
export type ReviewerVerdict = Infer<typeof reviewerVerdictValidator>;
export type ThreadPreview = Infer<typeof threadPreviewValidator>;
export type FailingCheck = Infer<typeof failingCheckValidator>;
export type QueuePull = Infer<typeof queuePullValidator>;
export type PromotedPull = Infer<typeof promotedPullValidator>;
export type StageGap = Infer<typeof stageGapValidator>;
export type RepoFlow = Infer<typeof repoFlowValidator>;
export type Pipeline = Infer<typeof pipelineValidator>;
