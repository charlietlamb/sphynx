import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { postJson } from "@/lib/api";
import { keys } from "@/lib/query/keys";

/**
 * Re-materialize an installation as if it were freshly connected. The server
 * backfills the read model and seeds the workbench feed, then the SSE `dirty`
 * signal repaints the open dashboard — so there is no manual reload.
 */
export function useResync(installationId: number | null, label: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["resync", installationId],
    mutationFn: () => {
      if (installationId === null) {
        return Promise.reject(new Error("No organization selected"));
      }
      return postJson(`/installations/${installationId}/resync`);
    },
    onSuccess: () => {
      toast.success(`Resyncing ${label}…`, {
        description: "The dashboard updates as data lands.",
      });
    },
    onError: () => {
      toast.error("Could not start resync");
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: [...keys.all, "installation"],
      }),
  });
}
