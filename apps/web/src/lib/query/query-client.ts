import { isServer, QueryClient } from "@tanstack/react-query";

const queryClientOptions = {
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      /**
       * Refetch when the user comes back to the tab, bounded by `staleTime` so
       * a quick alt-tab costs nothing. Without this, returning to a dashboard
       * left open shows whatever was true when it was last focused.
       */
      refetchOnWindowFocus: true,
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
