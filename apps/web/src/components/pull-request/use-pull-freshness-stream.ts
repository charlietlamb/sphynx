import type { PullRequestRef } from "@sphynx/schema/pull-requests";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
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

  useEffect(() => {
    if (installationId === null) {
      return;
    }
    const source = new EventSource(
      `/api/github/events?installation=${installationId}`
    );
    const onPull = (message: MessageEvent<string>) => {
      let event: PullDirty;
      try {
        event = JSON.parse(message.data) as PullDirty;
      } catch {
        return;
      }
      if (
        event.owner !== ref.owner ||
        event.repo !== ref.repo ||
        event.number !== ref.number
      ) {
        return;
      }
      onHead(event.headSha);
      queryClient.invalidateQueries({ queryKey: keys.pullSummary(ref) });
      queryClient.invalidateQueries({ queryKey: keys.pullConversation(ref) });
      queryClient.invalidateQueries({ queryKey: keys.pullThreads(ref) });
    };
    source.addEventListener("pull", onPull);
    return () => {
      source.removeEventListener("pull", onPull);
      source.close();
    };
  }, [installationId, ref, onHead, queryClient]);
}
