import { isServer, QueryClient } from "@tanstack/react-query";

const queryClientOptions = {
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
      placeholderData: <T>(previous: T) => previous,
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
