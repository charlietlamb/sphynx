import { convexQuery } from "@convex-dev/react-query";
import { api } from "@sphynx/backend/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";

/**
 * The installation id owning a repo, resolved live from the read model (Convex,
 * no GitHub call). `"skip"` gates the subscription until the caller is ready.
 */
export function usePullInstallation(owner: string, enabled: boolean) {
  const query = useQuery({
    ...convexQuery(
      api.github.reader.installationForOwner,
      enabled ? { owner } : "skip"
    ),
  });
  return query.data ?? null;
}
