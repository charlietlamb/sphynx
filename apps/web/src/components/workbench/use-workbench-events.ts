import { convexQuery } from "@convex-dev/react-query";
import { api } from "@sphynx/backend/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { MergedWorkbenchEvent } from "@/components/workbench/workbench-copy";
import { toWorkbenchKind } from "@/components/workbench/workbench-kind";
import { useWorkbenchStore } from "@/components/workbench/workbench-store";
import { useSession } from "@/lib/auth-client";

export function useWorkbenchEvents(
  owner: string,
  repo: string,
  installationId: number | null,
  enabled: boolean,
  pullTitles: ReadonlyMap<number, string>
) {
  const server = useQuery(
    convexQuery(
      api.github.reader.readWorkbench,
      enabled && installationId !== null
        ? { installationId, owner, repo }
        : "skip"
    )
  );
  const local = useWorkbenchStore(owner, repo);
  const { data: session } = useSession();

  const events = useMemo<readonly MergedWorkbenchEvent[]>(() => {
    const github = (server.data?.events ?? []).flatMap((event) => {
      const kind = toWorkbenchKind(event.kind);
      if (kind === null) {
        return [];
      }
      const merged: MergedWorkbenchEvent = {
        id: event.id,
        at: event.at,
        actor: event.actor,
        kind,
        detail: event.detail,
        url: event.url,
        pull: event.pull
          ? {
              number: event.pull.number,
              title:
                event.pull.title ?? pullTitles.get(event.pull.number) ?? null,
            }
          : null,
        source: "github",
      };
      return [merged];
    });
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
    viewer: session?.user?.name ?? null,
    isPending: server.isPending,
    isError: server.isError,
    refetch: server.refetch,
  };
}
