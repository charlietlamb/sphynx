import {
  type DiscoveredRepo,
  PipelineSchema,
  QueueSchema,
  type RepoFlow,
  RepoFlowSchema,
  ReposSchema,
} from "@sphynx/schema/review-queue";
import { useQuery } from "@tanstack/react-query";
import { Schema } from "effect";
import type { RepoOption } from "@/components/dashboard/repo-switcher";
import { isContested, isMergeable, repoKeyOf } from "@/lib/attention";
import { fetchGithub } from "@/lib/github-api";
import { keys } from "@/lib/query/keys";

async function fetchPipeline(installationId: number | null) {
  const response = await fetchGithub("/pipeline", "pipeline", installationId);
  return Schema.decodeUnknownPromise(PipelineSchema)(await response.json());
}

async function fetchRepos(installationId: number | null) {
  const response = await fetchGithub("/repos", "repos", installationId);
  return Schema.decodeUnknownPromise(ReposSchema)(await response.json());
}

export function toDiscoveredRepoOption(repo: DiscoveredRepo): RepoOption {
  return {
    key: repoKeyOf(repo),
    owner: repo.owner,
    repo: repo.repo,
    openCount: repo.openPulls,
    mergeable: 0,
    contested: 0,
  };
}

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

async function fetchQueue(installationId: number | null) {
  const response = await fetchGithub("/queue", "queue", installationId);
  return Schema.decodeUnknownPromise(QueueSchema)(await response.json());
}

async function fetchRepoFlow(
  installationId: number | null,
  owner: string,
  repo: string
) {
  const response = await fetchGithub(
    `/repos/${owner}/${repo}/flow`,
    "repo flow",
    installationId
  );
  return Schema.decodeUnknownPromise(RepoFlowSchema)(await response.json());
}

/**
 * The key carries identity only. Freshness is pushed: the server materializes
 * the read model from webhooks and notifies over SSE, and `useReadModelStream`
 * invalidates these queries on that signal. There is no wall-clock poll — a read
 * is an instant Neon query, and it only refetches when the model actually moves.
 */
export function usePipeline(installationId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: keys.pipeline(installationId),
    queryFn: () => fetchPipeline(installationId),
    enabled,
  });
}

/**
 * The queue without the promotion rail. It skips the per-repo compare fan-out,
 * so it resolves in roughly a third of the time and lets the queue paint while
 * the rail is still loading.
 */
export function useQueue(installationId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: keys.queue(installationId),
    queryFn: () => fetchQueue(installationId),
    enabled,
  });
}

/**
 * Every repo the installation can see, so the switcher lists quiet repos the
 * pipeline omits. Slower-moving than the pipeline (repo access rarely changes),
 * so it does not share the pipeline's SSE-driven invalidation.
 */
export function useRepos(installationId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: keys.repos(installationId),
    queryFn: () => fetchRepos(installationId),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * One repo's flow, fetched on demand when the selected repo has no flow in the
 * installation pipeline yet — a freshly added or quiet repo. Renders that repo
 * without waiting on the whole-installation build, and the server write-through
 * means the pipeline picks it up on the next read. Shares the pipeline's
 * SSE-driven invalidation via the repo-flow key.
 */
export function useRepoFlow(
  installationId: number | null,
  owner: string | null,
  repo: string | null,
  enabled: boolean
) {
  return useQuery({
    queryKey: keys.repoFlow(installationId, owner, repo),
    queryFn: () => fetchRepoFlow(installationId, owner ?? "", repo ?? ""),
    enabled: enabled && owner !== null && repo !== null,
  });
}
