import { api } from "@sphynx/backend/convex/_generated/api";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAction } from "convex/react";
import { keys } from "@/lib/query/keys";
import { useDebounced } from "@/lib/use-debounced";

const DEBOUNCE_MS = 250;
const RESULT_LIMIT = 30;

export function usePullSearch(query: string, installationId: number | null) {
  const debounced = useDebounced(query.trim(), DEBOUNCE_MS);
  const search = useAction(api.github.searchActions.search);
  const server = useQuery({
    queryKey: keys.search(installationId, debounced),
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
    pulls: server.data?.pulls ?? [],
    totalCount: server.data?.totalCount ?? 0,
  };
}
