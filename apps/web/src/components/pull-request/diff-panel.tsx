import type {
  PullRequestPatches,
  PullRequestRef,
} from "@sphynx/schema/pull-requests";
import { EmptyState } from "@sphynx/ui/components/empty-state";
import { Button } from "@sphynx/ui/components/ui/button";
import { lazy, type ReactNode, Suspense } from "react";
import { NoticePanel } from "@/components/layout/notice-panel";
import type {
  PatchMap,
  SymbolIndex,
} from "@/components/pull-request/patch-map";
import { toErrorCardProps } from "@/components/pull-request/pull-request-queries";
import { WorkspaceSkeleton } from "@/components/pull-request/workspace-skeleton";

const loadDiffWorkspace = () =>
  import("@/components/pull-request/diff-workspace");

const DiffWorkspace = lazy(loadDiffWorkspace);

/**
 * Warm the heavy diff chunk during idle time, not at import — so fetching it
 * never contends with the paint-gating summary request or the first render.
 * `requestIdleCallback` falls back to a short timeout where unsupported.
 */
if (typeof window !== "undefined") {
  const warm = () => loadDiffWorkspace().catch(() => undefined);
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(warm);
  } else {
    setTimeout(warm, 200);
  }
}

interface DiffPanelProps {
  data: PullRequestPatches | undefined;
  error: unknown;
  headSha: string;
  isError: boolean;
  isPending: boolean;
  patches: PatchMap;
  pullRequestRef: PullRequestRef;
  refetch: () => void;
  symbolIndex: SymbolIndex;
}

/**
 * The diff half of the page: the loading, empty and error states around the
 * workspace. Split out so the page component stays readable.
 */
export function DiffPanel({
  data,
  error,
  headSha,
  isError,
  isPending,
  patches,
  pullRequestRef,
  refetch,
  symbolIndex,
}: DiffPanelProps): ReactNode {
  if (isError) {
    const card = toErrorCardProps(error, refetch);
    return (
      <NoticePanel
        action={
          card.onRetry ? (
            <Button className="h-9 px-4" onClick={card.onRetry} size="sm">
              Try again
            </Button>
          ) : undefined
        }
        description={card.description}
        title={card.title}
      />
    );
  }

  if (isPending || !data) {
    return <WorkspaceSkeleton />;
  }

  if (data.files.length === 0) {
    return (
      <EmptyState
        className="mx-4 mt-3 self-start"
        description="This pull request has no changed files."
        title="No changed files"
      />
    );
  }

  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <DiffWorkspace
        files={data.files}
        headSha={headSha}
        patches={patches}
        pullRequestRef={pullRequestRef}
        symbolIndex={symbolIndex}
      />
    </Suspense>
  );
}
