import { SearchResultsSchema } from "@sphynx/schema/review-queue";
import {
  keepPreviousData,
  queryOptions,
  useQuery,
} from "@tanstack/react-query";
import { Schema } from "effect";
import { fetchGithub } from "@/lib/github-api";
import { keys } from "@/lib/query/keys";
import { useDebounced } from "@/lib/use-debounced";

const DEBOUNCE_MS = 250;
const RESULT_LIMIT = 30;

async function fetchPullSearch(query: string, installationId: number | null) {
  const params = new URLSearchParams({ q: query, limit: `${RESULT_LIMIT}` });
  const response = await fetchGithub(
    `/search/pulls?${params}`,
    "search",
    installationId
  );
  return await Schema.decodeUnknownPromise(SearchResultsSchema)(
    await response.json()
  );
}

function pullSearchQuery(query: string, installationId: number | null) {
  return queryOptions({
    queryKey: keys.search(installationId, query),
    queryFn: () => fetchPullSearch(query, installationId),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function usePullSearch(query: string, installationId: number | null) {
  const debounced = useDebounced(query.trim(), DEBOUNCE_MS);
  const server = useQuery({
    ...pullSearchQuery(debounced, installationId),
    enabled: debounced.length > 0,
  });

  return {
    active: debounced.length > 0,
    isError: server.isError,
    isPending: server.isFetching,
    pulls: server.data?.pulls ?? [],
    totalCount: server.data?.totalCount ?? 0,
  };
}
