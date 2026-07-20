import { PipelineVersionSchema } from "@sphynx/schema/review-queue";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Schema } from "effect";
import { useEffect, useRef } from "react";
import { fetchGithub } from "@/lib/github-api";
import { useVisiblePoll } from "@/lib/use-visible-poll";

const POLL_MS = 60_000;
const MIN_REFETCH_MS = 60_000;

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

export function usePipelineFreshness(
  installationId: number | null,
  enabled: boolean
) {
  const client = useQueryClient();
  const probe = useQuery({
    queryKey: ["pipeline-version", installationId],
    queryFn: () => fetchPipelineVersion(installationId),
    enabled,
    retry: false,
    staleTime: POLL_MS,
  });

  useVisiblePoll({
    enabled,
    intervalMs: POLL_MS,
    onPoll: () => probe.refetch(),
  });

  const seen = useRef<string | null>(null);
  const lastInvalidated = useRef(0);
  const version = probe.data?.version ?? null;

  useEffect(() => {
    if (version === null) {
      return;
    }
    const previous = seen.current;
    seen.current = version;
    if (previous === null || previous === version) {
      return;
    }
    const now = Date.now();
    if (now - lastInvalidated.current < MIN_REFETCH_MS) {
      return;
    }
    lastInvalidated.current = now;
    client.invalidateQueries({ queryKey: ["pipeline"] });
  }, [version, client]);
}
