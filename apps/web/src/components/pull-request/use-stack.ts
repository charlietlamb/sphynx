import type { PullRequestRef } from "@sphynx/schema/pull-requests";
import { useMemo } from "react";
import { usePipeline } from "@/components/dashboard/use-pipeline";
import { buildStack, type Stack } from "@/components/pull-request/stack";
import { usePullInstallation } from "@/components/pull-request/use-pull-installation";
import { useSession } from "@/lib/auth-client";

/**
 * The stack the given PR belongs to, live from the read model. The pipeline is a
 * Convex subscription, so the stack updates as PRs in it open, merge, or move —
 * no refetch. Returns null for a PR that is not part of a stack.
 */
export function useStack(ref: PullRequestRef): Stack | null {
  const { data: session, isPending } = useSession();
  const authed = Boolean(session?.user);
  const installationId = usePullInstallation(
    ref.owner,
    ref.repo,
    authed && !isPending
  );
  const pipeline = usePipeline(installationId, installationId !== null);

  return useMemo(() => {
    const flow = pipeline.data?.repos.find(
      (candidate) =>
        candidate.owner === ref.owner && candidate.repo === ref.repo
    );
    if (!flow) {
      return null;
    }
    return buildStack(flow.openPulls, ref.number);
  }, [pipeline.data, ref.owner, ref.repo, ref.number]);
}
