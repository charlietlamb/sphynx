import { convexQuery } from "@convex-dev/react-query";
import { api } from "@sphynx/backend/convex/_generated/api";
import type { RepoFlow } from "@sphynx/schema/review-queue";
import { useQuery } from "@tanstack/react-query";
import type { RepoOption } from "@/components/dashboard/repo-switcher";
import { isContested, isMergeable, repoKeyOf } from "@/lib/attention";

export function toRepoOption(flow: RepoFlow): RepoOption {
  let mergeable = 0;
  let contested = 0;
  for (const pull of flow.openPulls) {
    if (isMergeable(pull)) {
      mergeable += 1;
    }
    if (isContested(pull)) {
      contested += 1;
    }
  }
  return {
    key: repoKeyOf(flow),
    owner: flow.owner,
    repo: flow.repo,
    openCount: flow.openPulls.length,
    mergeable,
    contested,
  };
}

/**
 * The dashboard pipeline, live from Convex. A Convex query subscribes over a
 * WebSocket, so any write to the read model (webhook, materialize, reconcile)
 * repaints subscribers automatically — no wall-clock poll, no invalidation.
 * `"skip"` gates the subscription until an installation is known.
 */
export function usePipeline(installationId: number | null, enabled: boolean) {
  return useQuery({
    ...convexQuery(
      api.github.reader.getPipeline,
      enabled && installationId !== null ? { installationId } : "skip"
    ),
  });
}

/** The queue without the promotion rail — paints while the rail loads. */
export function useQueue(installationId: number | null, enabled: boolean) {
  return useQuery({
    ...convexQuery(
      api.github.reader.getQueue,
      enabled && installationId !== null ? { installationId } : "skip"
    ),
  });
}

/**
 * One repo's open pulls, fetched on demand when the selected repo has no flow in
 * the installation pipeline yet — a freshly added or quiet repo. Live like the
 * pipeline.
 */
export function useRepoFlow(
  installationId: number | null,
  owner: string | null,
  repo: string | null,
  enabled: boolean
) {
  return useQuery({
    ...convexQuery(
      api.github.reader.getRepoPulls,
      enabled && installationId !== null && owner !== null && repo !== null
        ? { installationId, owner, repo }
        : "skip"
    ),
  });
}
