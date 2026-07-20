import { PipelineSchema, type RepoFlow } from "@sphynx/schema/review-queue";
import { useQuery } from "@tanstack/react-query";
import { Schema } from "effect";
import type { RepoOption } from "@/components/dashboard/repo-switcher";
import { isContested, isMergeable, repoKeyOf } from "@/lib/attention";
import { fetchGithub } from "@/lib/github-api";

async function fetchPipeline(installationId: number | null) {
  const response = await fetchGithub("/pipeline", "pipeline", installationId);
  return Schema.decodeUnknownPromise(PipelineSchema)(await response.json());
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

const REFRESH_MS = 45_000;

/**
 * The key carries identity only. Freshness is the server's job: it revalidates
 * each repo's pulls with a conditional request, which costs no rate limit when
 * nothing changed, so refetching on an interval is cheap.
 */
export function usePipeline(installationId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: ["pipeline", installationId],
    queryFn: () => fetchPipeline(installationId),
    enabled,
    staleTime: REFRESH_MS,
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
  });
}
