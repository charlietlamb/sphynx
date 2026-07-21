import { ResolvedInstallationSchema } from "@sphynx/schema/review-queue";
import { useQuery } from "@tanstack/react-query";
import { Schema } from "effect";
import { fetchGithub } from "@/lib/github-api";
import { keys } from "@/lib/query/keys";

async function resolveInstallation(owner: string) {
  const response = await fetchGithub(
    `/installations/resolve/${owner}`,
    "resolve-installation"
  );
  const { installationId } = await Schema.decodeUnknownPromise(
    ResolvedInstallationSchema
  )(await response.json());
  return installationId;
}

/**
 * The installation id owning a repo, resolved from the read model (DB only, no
 * GitHub call) so the PR page can scope its SSE stream without the live
 * installations list. Cached long — an owner's installation rarely changes.
 */
export function usePullInstallation(owner: string, enabled: boolean) {
  const query = useQuery({
    queryKey: [...keys.all, "installation-for-owner", owner],
    queryFn: () => resolveInstallation(owner),
    enabled,
    staleTime: 30 * 60_000,
  });
  return query.data ?? null;
}
