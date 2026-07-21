import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { postJson } from "@/lib/api";

/**
 * Re-materialize an installation as if it were freshly connected. The server
 * backfills the read model and seeds the workbench feed, then the SSE `dirty`
 * signal repaints the open dashboard as rows land — so there is no manual
 * reload, and no eager invalidate here: refetching now would read the read model
 * mid-rebuild and could flash a partial or empty dashboard before SSE repaints.
 */
export function useResync(installationId: number | null, label: string) {
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
  });
}
