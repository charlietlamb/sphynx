import type { PullRequestRef } from "@sphynx/schema/pull-requests";
import { EmptyState } from "@sphynx/ui/components/empty-state";
import { Button } from "@sphynx/ui/components/ui/button";
import { Skeleton } from "@sphynx/ui/components/ui/skeleton";
import { lazy, type ReactNode, Suspense, useMemo } from "react";
import { ErrorCard } from "@/components/layout/error-card";
import { SiteLayout } from "@/components/layout/site-layout";
import { PullRequestHeader } from "@/components/pull-request/pull-request-header";
import {
  toErrorCardProps,
  usePullRequest,
  usePullRequestFreshness,
} from "@/components/pull-request/pull-request-queries";
import { PullRequestRefresh } from "@/components/pull-request/pull-request-refresh";
import { buildSymbolIndex } from "@/components/pull-request/symbol-index";
import { useDocumentTitle } from "@/lib/use-document-title";

const loadDiffWorkspace = () =>
  import("@/components/pull-request/diff-workspace");
const DiffWorkspace = lazy(loadDiffWorkspace);
if (typeof window !== "undefined") {
  loadDiffWorkspace().catch(() => undefined);
}

const workspaceSkeleton = (
  <div className="flex min-h-0 flex-1 gap-5">
    <Skeleton className="h-full w-64 shrink-0" />
    <Skeleton className="h-full min-w-0 flex-1" />
  </div>
);

interface PullRequestPageProps {
  pullRequestRef: PullRequestRef;
}

export function PullRequestPage({ pullRequestRef }: PullRequestPageProps) {
  const { pullRequest, files } = usePullRequest(pullRequestRef);
  const freshness = usePullRequestFreshness(pullRequestRef);
  const symbolIndex = useMemo(
    () => buildSymbolIndex(files.data ?? []),
    [files.data]
  );
  useDocumentTitle(pullRequest.data?.title);

  if (pullRequest.isError) {
    return (
      <ErrorCard
        {...toErrorCardProps(pullRequest.error, () => pullRequest.refetch())}
      />
    );
  }

  let filesContent: ReactNode;
  if (files.isError) {
    const filesError = toErrorCardProps(files.error, () => files.refetch());
    filesContent = (
      <div className="flex flex-col items-start gap-3 self-start rounded-md border border-border p-4 text-sm">
        <p className="font-medium">{filesError.title}</p>
        <p className="text-muted-foreground">{filesError.description}</p>
        {filesError.onRetry ? (
          <Button onClick={filesError.onRetry} size="sm" variant="outline">
            Try again
          </Button>
        ) : null}
      </div>
    );
  } else if (files.isPending) {
    filesContent = workspaceSkeleton;
  } else if (files.data.length === 0) {
    filesContent = (
      <EmptyState
        className="self-start"
        description="This pull request has no changed files."
        title="No changed files"
      />
    );
  } else {
    filesContent = (
      <Suspense fallback={workspaceSkeleton}>
        <DiffWorkspace
          files={files.data}
          headSha={pullRequest.data?.head.sha ?? ""}
          pullRequestRef={pullRequestRef}
          symbolIndex={symbolIndex}
        />
      </Suspense>
    );
  }

  return (
    <SiteLayout fill>
      <div className="flex flex-1 items-center justify-center md:hidden">
        <EmptyState
          description="Open this pull request on a larger screen to review the diff."
          title="Sphynx is better on desktop"
        />
      </div>
      <div className="hidden min-h-0 flex-1 flex-col gap-5 pt-2 md:flex">
        {pullRequest.isPending ? (
          <div className="flex flex-col gap-3 border-border border-b pb-4">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-5 w-96" />
          </div>
        ) : (
          <PullRequestHeader
            pullRequest={pullRequest.data}
            refresh={
              freshness.hasNewChanges ? (
                <PullRequestRefresh
                  onRefresh={freshness.refresh}
                  refreshing={freshness.refreshing}
                />
              ) : null
            }
          />
        )}
        {filesContent}
      </div>
    </SiteLayout>
  );
}
