import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { keys } from "@/lib/query/keys";

/**
 * Subscribe to the server's read-model change stream for one installation.
 *
 * The server pushes a `dirty` event whenever a webhook or rebuild updates the
 * installation's rows; the client responds by invalidating the installation's
 * queries, which refetches the (now-instant) Neon-backed pipeline, queue, and
 * workbench feed. This replaces the wall-clock `refetchInterval` polls.
 *
 * The workbench feed keys under `repo`, not `installation`, so it is caught by a
 * predicate matching any `repoEvents` query for this installation rather than a
 * prefix.
 *
 * `EventSource` is an external subscription, so its lifecycle belongs in an
 * effect — but no request data flows through React state.
 */
export function useReadModelStream(
  installationId: number | null,
  enabled: boolean
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!(enabled && installationId !== null)) {
      return;
    }
    const source = new EventSource(
      `/api/github/events?installation=${installationId}`
    );
    const invalidate = () => {
      queryClient.invalidateQueries({
        queryKey: keys.installation(installationId),
      });
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return (
            key[0] === "gh" &&
            key[1] === "repo" &&
            key[4] === "events" &&
            key[5] === installationId
          );
        },
      });
    };
    source.addEventListener("dirty", invalidate);
    return () => {
      source.removeEventListener("dirty", invalidate);
      source.close();
    };
  }, [installationId, enabled, queryClient]);
}
