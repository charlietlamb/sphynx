import type { PullRequestRef } from "@sphynx/schema/pull-requests";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { keys } from "@/lib/query/keys";

interface PullDirty {
  readonly headSha: string;
  readonly number: number;
  readonly owner: string;
  readonly repo: string;
}

/**
 * Push-driven freshness for one pull request.
 *
 * Opens the installation's SSE stream and, on a `pull` event whose ref matches
 * this page, reports the new head sha and invalidates the freshness-sensitive
 * queries (summary, conversation, threads) — never the immutable ones (patches
 * and sha-addressed file contents). This replaces the 45s head poll.
 *
 * `EventSource` is an external subscription, so its lifecycle belongs in an
 * effect; no request data flows through React state here.
 */
export function usePullFreshnessStream(
  installationId: number | null,
  ref: PullRequestRef,
  onHead: (sha: string) => void
) {
  const queryClient = useQueryClient();
  const { owner, repo, number } = ref;
  /**
   * Rebuild a stable ref from the primitives so the effect below re-subscribes
   * only when the pull actually changes, never on an incidental new `ref`
   * object identity from a parent re-render.
   */
  const stableRef = useMemo(
    () => ({ owner, repo, number }),
    [owner, repo, number]
  );

  useEffect(() => {
    if (installationId === null) {
      return;
    }
    const source = new EventSource(
      `/api/github/events?installation=${installationId}`
    );
    const refreshFreshness = () => {
      queryClient.invalidateQueries({ queryKey: keys.pullSummary(stableRef) });
      queryClient.invalidateQueries({
        queryKey: keys.pullConversation(stableRef),
      });
      queryClient.invalidateQueries({ queryKey: keys.pullThreads(stableRef) });
    };
    const onPull = (message: MessageEvent<string>) => {
      let event: PullDirty;
      try {
        event = JSON.parse(message.data) as PullDirty;
      } catch {
        return;
      }
      if (
        event.owner !== stableRef.owner ||
        event.repo !== stableRef.repo ||
        event.number !== stableRef.number
      ) {
        return;
      }
      if (event.headSha) {
        onHead(event.headSha);
      }
      refreshFreshness();
    };
    /**
     * A `pull` event that fired while the socket was down is never replayed, so
     * a reconnect (redeploy, wake, dropped connection) refetches once to recover
     * it. `open` fires on the first connect and every auto-reconnect; the first
     * is skipped since the initial query load already covers it.
     */
    let connected = false;
    const onOpen = () => {
      if (connected) {
        refreshFreshness();
      }
      connected = true;
    };
    /**
     * The server↔Postgres LISTEN reconnect wakes every installation with a
     * wildcard `dirty` — a signal the client socket stays up for, so `onOpen`
     * would miss it. Refetch this pull's freshness on `dirty` too, so a
     * head-move whose `pull` notify was lost in that gap is still recovered.
     */
    const onDirty = () => refreshFreshness();
    source.addEventListener("pull", onPull);
    source.addEventListener("open", onOpen);
    source.addEventListener("dirty", onDirty);
    return () => {
      source.removeEventListener("pull", onPull);
      source.removeEventListener("open", onOpen);
      source.removeEventListener("dirty", onDirty);
      source.close();
    };
  }, [installationId, stableRef, onHead, queryClient]);
}
