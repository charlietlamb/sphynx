import { PipelineSchema, type RepoFlow } from "@sphynx/schema/review-queue";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Schema } from "effect";
import type { RepoOption } from "@/components/dashboard/repo-switcher";
import { isContested, isMergeable, repoKeyOf } from "@/lib/attention";
import { fetchGithub } from "@/lib/github-api";

async function fetchPipeline(
  installationId: number | null,
  since: string | null
) {
  const response = await fetchGithub(
    since === null
      ? "/pipeline"
      : `/pipeline?since=${encodeURIComponent(since)}`,
    "pipeline",
    installationId
  );
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

/**
 * `version` keys the query, so a fingerprint change refetches and tells the
 * server which build the client has already seen.
 */
export function usePipeline(
  installationId: number | null,
  enabled: boolean,
  version: string | null = null
) {
  return useQuery({
    queryKey: ["pipeline", installationId, version],
    queryFn: () => fetchPipeline(installationId, version),
    enabled,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}
