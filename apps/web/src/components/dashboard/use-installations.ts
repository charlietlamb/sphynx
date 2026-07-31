import { api } from "@sphynx/backend/convex/_generated/api";
import type { Installation } from "@sphynx/schema/review-queue";
import { useQuery } from "@tanstack/react-query";
import { useAction } from "convex/react";
import { useSession } from "@/lib/auth-client";
import { keys } from "@/lib/query/keys";

export function useInstallations(selected: number | null, enabled: boolean) {
  const list = useAction(api.github.installations.listInstallations);
  const { data: session } = useSession();
  const userId = session?.user.id ?? null;
  const server = useQuery({
    queryKey: keys.installations(userId),
    queryFn: () => list(),
    enabled: enabled && userId !== null,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    refetchIntervalInBackground: true,
  });
  const installations: readonly Installation[] =
    server.data?.installations ?? [];

  return {
    active:
      installations.find((entry) => entry.id === selected) ??
      installations[0] ??
      null,
    error: server.error,
    installations,
    isError: server.isError,
    isPending: server.isPending,
  };
}
