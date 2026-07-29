import type { QueryClient } from "@tanstack/react-query";
import { clearAccessBlocks } from "@/components/pull-request/access-block-store";
import { keys } from "@/lib/query/keys";

export function clearUserState(queryClient: QueryClient) {
  queryClient.removeQueries({ queryKey: keys.all });
  clearAccessBlocks();
}
