import { isServer, QueryClient } from "@tanstack/react-query";

const queryClientOptions = {
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      /**
       * Off by default so returning to a tab doesn't refire every query on the
       * page. The dashboard opts in per-query, where the freshness probe makes
       * the refetch cheap.
       */
      refetchOnWindowFocus: false,
    },
  },
};

const makeQueryClient = () => new QueryClient(queryClientOptions);

let browserQueryClient: QueryClient | undefined;

export const getQueryClient = () => {
  if (isServer) {
    return makeQueryClient();
  }
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
};
