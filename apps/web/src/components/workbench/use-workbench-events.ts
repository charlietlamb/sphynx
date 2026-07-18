import { WorkbenchFeedSchema } from "@sphynx/schema/workbench";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { Schema } from "effect";
import { useMemo } from "react";
import type { MergedWorkbenchEvent } from "@/components/workbench/workbench-copy";
import { useWorkbenchStore } from "@/components/workbench/workbench-store";

async function fetchWorkbenchEvents(
  owner: string,
  repo: string,
  authed: boolean
) {
  const base = authed && !import.meta.env.DEV ? "/api/github" : "/api/dev";
  const response = await fetch(`${base}/repos/${owner}/${repo}/events`);
  if (!response.ok) {
    throw new Error(`events unavailable (${response.status})`);
  }
  const decoded = await Schema.decodeUnknownPromise(WorkbenchFeedSchema)(
    await response.json()
  );
  return decoded.events;
}

function workbenchEventsQuery(owner: string, repo: string, authed: boolean) {
  return queryOptions({
    queryKey: ["repo-events", owner, repo, authed],
    queryFn: () => fetchWorkbenchEvents(owner, repo, authed),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useWorkbenchEvents(
  owner: string,
  repo: string,
  authed: boolean,
  enabled: boolean,
  pullTitles: ReadonlyMap<number, string>
) {
  const server = useQuery({
    ...workbenchEventsQuery(owner, repo, authed),
    enabled,
  });
  const local = useWorkbenchStore(owner, repo);

  const events = useMemo<readonly MergedWorkbenchEvent[]>(() => {
    const github = (server.data ?? []).map(
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
    isPending: server.isPending,
    isError: server.isError,
    refetch: server.refetch,
  };
}
