import { api } from "@sphynx/backend/convex/_generated/api";
import type { Installation } from "@sphynx/schema/review-queue";
import { useQuery } from "@tanstack/react-query";
import { useAction } from "convex/react";
import { keys } from "@/lib/query/keys";

export function useInstallations(selected: number | null, enabled: boolean) {
  const list = useAction(api.github.installations.listInstallations);
  const server = useQuery({
    queryKey: keys.installations(),
    queryFn: () => list(),
    enabled,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });
  const installations: readonly Installation[] =
    server.data?.installations ?? [];

  return {
    active:
      installations.find((entry) => entry.id === selected) ??
      installations[0] ??
      null,
    installations,
    isError: server.isError,
    isPending: server.isPending,
  };
}
