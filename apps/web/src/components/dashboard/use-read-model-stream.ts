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
    /**
     * Coalesce a burst of `dirty` events (a CI matrix reporting 50 checks at
     * once notifies per write) into a single trailing refetch, so the dashboard
     * refetches once when the burst settles rather than churning per event.
     */
    let timer: ReturnType<typeof setTimeout> | null = null;
    const invalidateSoon = () => {
      if (timer !== null) {
        clearTimeout(timer);
      }
      timer = setTimeout(invalidate, 300);
    };
    /**
     * SSE frames carry no id and are not replayed, so any `dirty` that fired
     * while the socket was down (a server redeploy, a laptop wake, a dropped
     * connection) is lost. `onopen` fires on the first connect and on every
     * browser auto-reconnect; skipping the first, a reconnect refetches once to
     * recover whatever was missed during the gap — the only backstop now that
     * the wall-clock poll is gone. This one is immediate, not debounced: a
     * reconnect should recover promptly.
     */
    let connected = false;
    const onOpen = () => {
      if (connected) {
        invalidate();
      }
      connected = true;
    };
    source.addEventListener("dirty", invalidateSoon);
    source.addEventListener("open", onOpen);
    return () => {
      if (timer !== null) {
        clearTimeout(timer);
      }
      source.removeEventListener("dirty", invalidateSoon);
      source.removeEventListener("open", onOpen);
      source.close();
    };
  }, [installationId, enabled, queryClient]);
}
