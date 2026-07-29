import { api } from "@sphynx/backend/convex/_generated/api";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAction } from "convex/react";
import { asQueuePulls } from "@/lib/read-model";
import { useDebounced } from "@/lib/use-debounced";

const DEBOUNCE_MS = 250;
const RESULT_LIMIT = 30;

export function usePullSearch(query: string, installationId: number | null) {
  const debounced = useDebounced(query.trim(), DEBOUNCE_MS);
  const search = useAction(api.github.searchActions.search);
  const server = useQuery({
    queryKey: ["search", installationId, debounced],
    queryFn: () =>
      search({
        installationId: installationId as number,
        query: debounced,
        limit: RESULT_LIMIT,
      }),
    enabled: debounced.length > 0 && installationId !== null,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  return {
    active: debounced.length > 0,
    isError: server.isError,
    isPending: server.isFetching,
    pulls: asQueuePulls(server.data?.pulls ?? []),
    totalCount: server.data?.totalCount ?? 0,
  };
}
