import type { PullRequestRef } from "@sphynx/schema/pull-requests";
import { EmptyState } from "@sphynx/ui/components/empty-state";
import { Button } from "@sphynx/ui/components/ui/button";
import { Navigate, useLocation } from "@tanstack/react-router";
import { lazy, type ReactNode, Suspense, useMemo, useState } from "react";
import { ErrorCard } from "@/components/layout/error-card";
import { PullRequestHeader } from "@/components/pull-request/pull-request-header";
import { PullRequestHeaderSkeleton } from "@/components/pull-request/pull-request-header-skeleton";
import {
  toErrorCardProps,
  useAccessBlock,
  usePullRequest,
  usePullRequestFreshness,
  useViewedFiles,
} from "@/components/pull-request/pull-request-queries";
import { PullRequestRefresh } from "@/components/pull-request/pull-request-refresh";
import { ReviewAccessBanner } from "@/components/pull-request/review-access-banner";
import { buildSymbolIndex } from "@/components/pull-request/symbol-index";
import { ViewedProgress } from "@/components/pull-request/viewed-progress";
import { WorkspaceSkeleton } from "@/components/pull-request/workspace-skeleton";
import { useSession } from "@/lib/auth-client";
import { useDocumentTitle } from "@/lib/use-document-title";

const loadDiffWorkspace = () =>
  import("@/components/pull-request/diff-workspace");
const DiffWorkspace = lazy(loadDiffWorkspace);
if (typeof window !== "undefined") {
  loadDiffWorkspace().catch(() => undefined);
}

const workspaceSkeleton = <WorkspaceSkeleton />;

interface PullRequestPageProps {
  pullRequestRef: PullRequestRef;
}

export function PullRequestPage({ pullRequestRef }: PullRequestPageProps) {
  const { pullRequest, files } = usePullRequest(pullRequestRef);
  const { viewedFiles } = useViewedFiles(pullRequestRef);
  const freshness = usePullRequestFreshness(pullRequestRef);
  const accessBlock = useAccessBlock(pullRequestRef);
  const symbolIndex = useMemo(
    () => buildSymbolIndex(files.data ?? []),
    [files.data]
  );
  useDocumentTitle(pullRequest.data?.title);
  const { data: session, isPending: sessionPending } = useSession();
  const currentHref = useLocation({ select: (location) => location.href });
  const [redirectTarget] = useState(currentHref);

  if (!(sessionPending || session?.user)) {
    return <Navigate search={{ redirect: redirectTarget }} to="/login" />;
  }

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
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="w-full max-w-md border border-border bg-background p-8 text-left">
          <div className="flex flex-col gap-3">
            <h2 className="font-heading text-2xl tracking-tight">
              {filesError.title}
            </h2>
            <p className="text-muted-foreground text-sm">
              {filesError.description}
            </p>
            {filesError.onRetry ? (
              <div className="mt-3">
                <Button
                  className="h-9 px-4"
                  onClick={filesError.onRetry}
                  size="sm"
                >
                  Try again
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  } else if (files.isPending) {
    filesContent = workspaceSkeleton;
  } else if (files.data.length === 0) {
    filesContent = (
      <EmptyState
        className="mx-4 mt-3 self-start"
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
    <main className="flex h-svh flex-col overflow-hidden bg-background text-foreground">
      <div className="flex flex-1 items-center justify-center md:hidden">
        <EmptyState
          description="Open this pull request on a larger screen to review the diff."
          title="Sphynx is better on desktop"
        />
      </div>
      <div className="hidden min-h-0 flex-1 flex-col md:flex">
        {pullRequest.isPending ? (
          <PullRequestHeaderSkeleton />
        ) : (
          <PullRequestHeader
            progress={
              viewedFiles && files.data ? (
                <ViewedProgress
                  total={files.data.length}
                  viewed={
                    files.data.filter((candidate) =>
                      viewedFiles.has(candidate.path)
                    ).length
                  }
                />
              ) : null
            }
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
        <ReviewAccessBanner
          blockedMessage={accessBlock}
          owner={pullRequestRef.owner}
        />
        {filesContent}
      </div>
    </main>
  );
}
