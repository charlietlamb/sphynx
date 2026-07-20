import { PipelineVersionSchema } from "@sphynx/schema/review-queue";
import { useQuery } from "@tanstack/react-query";
import { Schema } from "effect";
import { fetchGithub } from "@/lib/github-api";
import { useVisiblePoll } from "@/lib/use-visible-poll";

const POLL_MS = 60_000;

async function fetchPipelineVersion(installationId: number | null) {
  const response = await fetchGithub(
    "/pipeline/version",
    "version",
    installationId
  );
  return await Schema.decodeUnknownPromise(PipelineVersionSchema)(
    await response.json()
  );
}

/**
 * Polls a cheap fingerprint of the pipeline while the tab is visible. The
 * version is returned rather than acted on: callers pass it to `usePipeline`,
 * so a change refetches through the query key and reaches the server with
 * `since`, which is what gets past the server-side cache.
 */
export function usePipelineFreshness(
  installationId: number | null,
  enabled: boolean
) {
  const probe = useQuery({
    queryKey: ["pipeline-version", installationId],
    queryFn: () => fetchPipelineVersion(installationId),
    enabled,
    retry: false,
    staleTime: POLL_MS,
    /**
     * The probe is a single cheap request, so re-checking on focus is worth it
     * — it is what surfaces changes made while the tab was in the background.
     */
    refetchOnWindowFocus: true,
  });

  useVisiblePoll({
    enabled,
    intervalMs: POLL_MS,
    onPoll: () => probe.refetch(),
  });

  return probe.data?.version ?? null;
}
