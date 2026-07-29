import type {
  Pipeline,
  QueuePull,
  RepoFlow,
} from "@sphynx/schema/review-queue";

/**
 * The Convex read-model queries return values structurally identical to the
 * `@sphynx/schema` contract but as a distinct, mutable-array type. These typed
 * converters give the read model one boundary where a Convex result becomes the
 * canonical schema type the components consume, instead of scattered casts. The
 * runtime value is unchanged — only the nominal type.
 */
export const asPipeline = (value: unknown): Pipeline => value as Pipeline;

export const asRepoFlows = (value: unknown): readonly RepoFlow[] =>
  value as readonly RepoFlow[];

export const asQueuePulls = (value: unknown): readonly QueuePull[] =>
  value as readonly QueuePull[];
