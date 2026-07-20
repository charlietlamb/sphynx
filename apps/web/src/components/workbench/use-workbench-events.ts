import { WorkbenchFeedSchema } from "@sphynx/schema/workbench";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { Schema } from "effect";
import { useMemo } from "react";
import type { MergedWorkbenchEvent } from "@/components/workbench/workbench-copy";
import { useWorkbenchStore } from "@/components/workbench/workbench-store";
import { fetchGithub } from "@/lib/github-api";
import { keys } from "@/lib/query/keys";

async function fetchWorkbenchEvents(
  owner: string,
  repo: string,
  installationId: number | null
) {
  const response = await fetchGithub(
    `/repos/${owner}/${repo}/events`,
    "events",
    installationId
  );
  return await Schema.decodeUnknownPromise(WorkbenchFeedSchema)(
    await response.json()
  );
}

function workbenchEventsQuery(
  owner: string,
  repo: string,
  installationId: number | null
) {
  return queryOptions({
    queryKey: keys.repoEvents({ owner, repo }, installationId),
    queryFn: () => fetchWorkbenchEvents(owner, repo, installationId),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useWorkbenchEvents(
  owner: string,
  repo: string,
  installationId: number | null,
  enabled: boolean,
  pullTitles: ReadonlyMap<number, string>
) {
  const server = useQuery({
    ...workbenchEventsQuery(owner, repo, installationId),
    enabled,
  });
  const local = useWorkbenchStore(owner, repo);

  const events = useMemo<readonly MergedWorkbenchEvent[]>(() => {
    const github = (server.data?.events ?? []).map(
      (event): MergedWorkbenchEvent => ({
        ...event,
        pull: event.pull
          ? {
              number: event.pull.number,
              title:
                event.pull.title ?? pullTitles.get(event.pull.number) ?? null,
            }
          : null,
        source: "github",
      })
    );
    return [...github, ...local.events].sort(
      (a, b) => Date.parse(b.at) - Date.parse(a.at)
    );
  }, [server.data, local.events, pullTitles]);

  const unseen = useMemo(
    () =>
      events.filter((event) => Date.parse(event.at) > local.lastSeenAt).length,
    [events, local.lastSeenAt]
  );

  return {
    events,
    unseen,
    latest: events[0] ?? null,
    viewer: server.data?.viewer ?? null,
    isPending: server.isPending,
    isError: server.isError,
    refetch: server.refetch,
  };
}
