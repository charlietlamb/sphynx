export const MAX_USER_INSTALLATIONS = 100;

/**
 * How many `userRepository` rows one mutation deletes before rescheduling. Not a
 * cap on repositories per installation (there is none) — a batch size that keeps
 * a single mutation within Convex's per-transaction write limits when clearing a
 * large installation's grants.
 */
export const REPO_GRANT_DELETE_BATCH = 500;
export const MAX_PIPELINE_PULLS = 250;
export const MAX_PULL_DOCUMENT_BYTES = 40 * 1024;
