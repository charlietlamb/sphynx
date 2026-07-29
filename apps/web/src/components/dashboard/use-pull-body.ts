import { api } from "@sphynx/backend/convex/_generated/api";
import type { QueuePull } from "@sphynx/schema/review-queue";
import { useQuery } from "@tanstack/react-query";
import { useAction } from "convex/react";
import { keys } from "@/lib/query/keys";

export function usePullBody(
  pull: QueuePull,
  installationId: number | null,
  enabled: boolean
) {
  const getPullBody = useAction(api.github.searchActions.getPullBody);
  const query = useQuery({
    queryKey: keys.pullBody(pull),
    queryFn: () =>
      getPullBody({
        installationId: installationId ?? 0,
        owner: pull.owner,
        repo: pull.repo,
        number: pull.number,
      }),
    enabled: enabled && pull.hasBody && installationId !== null,
    staleTime: 5 * 60_000,
  });

  return {
    body: query.data?.body ?? null,
    isError: query.isError,
    isPending: query.isPending,
  };
}
