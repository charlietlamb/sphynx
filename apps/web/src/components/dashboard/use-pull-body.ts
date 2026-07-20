import { PullBodySchema, type QueuePull } from "@sphynx/schema/review-queue";
import { useQuery } from "@tanstack/react-query";
import { Schema } from "effect";
import { fetchGithub } from "@/lib/github-api";
import { keys } from "@/lib/query/keys";

async function fetchPullBody(pull: QueuePull, installationId: number | null) {
  const response = await fetchGithub(
    `/repos/${pull.owner}/${pull.repo}/pulls/${pull.number}/body`,
    "body",
    installationId
  );
  return await Schema.decodeUnknownPromise(PullBodySchema)(
    await response.json()
  );
}

export function usePullBody(
  pull: QueuePull,
  installationId: number | null,
  enabled: boolean
) {
  const query = useQuery({
    queryKey: keys.pullBody(pull),
    queryFn: () => fetchPullBody(pull, installationId),
    enabled: enabled && pull.hasBody,
    staleTime: 5 * 60_000,
  });

  return {
    body: query.data?.body ?? null,
    isError: query.isError,
    isPending: query.isPending,
  };
}
