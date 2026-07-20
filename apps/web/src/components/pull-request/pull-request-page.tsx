import type { PullRequestRef } from "@sphynx/schema/pull-requests";
import { EmptyState } from "@sphynx/ui/components/empty-state";
import { Button } from "@sphynx/ui/components/ui/button";
import { Navigate, useLocation } from "@tanstack/react-router";
import { lazy, type ReactNode, Suspense, useMemo, useState } from "react";
import { ErrorCard } from "@/components/layout/error-card";
import { NoticePanel } from "@/components/layout/notice-panel";
import { ConversationSkeleton } from "@/components/pull-request/conversation-skeleton";
import {
  EMPTY_PATCHES,
  EMPTY_SYMBOLS,
} from "@/components/pull-request/patch-map";
import { PullRequestCommands } from "@/components/pull-request/pull-request-commands";
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
import { usePullRequestSearch } from "@/components/pull-request/pull-request-search";
import { PullRequestTabs } from "@/components/pull-request/pull-request-tabs";
import { ReviewAccessBanner } from "@/components/pull-request/review-access-banner";
import { useTabKeys } from "@/components/pull-request/use-tab-keys";
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

const ConversationPanel = lazy(
  () => import("@/components/pull-request/conversation-panel")
);

const workspaceSkeleton = <WorkspaceSkeleton />;
const conversationSkeleton = <ConversationSkeleton />;

interface PullRequestPageProps {
  pullRequestRef: PullRequestRef;
}

export function PullRequestPage({ pullRequestRef }: PullRequestPageProps) {
  const { pullRequest, files, patches } = usePullRequest(pullRequestRef);
  const { viewedFiles, setAllViewed } = useViewedFiles(pullRequestRef);
  const freshness = usePullRequestFreshness(pullRequestRef);
  const accessBlock = useAccessBlock(pullRequestRef);
  const [{ tab }, setSearch] = usePullRequestSearch();
  useTabKeys(setSearch);
  const patchMap = useMemo(
    () =>
      patches.data
        ? new Map(Object.entries(patches.data.patches))
        : EMPTY_PATCHES,
    [patches.data]
  );
  const symbolIndex = useMemo(
    () =>
      patches.data
        ? new Map(Object.entries(patches.data.symbols))
        : EMPTY_SYMBOLS,
    [patches.data]
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

  let conversationContent: ReactNode;
  if (pullRequest.isPending) {
    conversationContent = conversationSkeleton;
  } else {
    conversationContent = (
      <Suspense fallback={conversationSkeleton}>
        <ConversationPanel
          files={files.data ?? []}
          patches={patchMap}
          pullRequestRef={pullRequestRef}
          setSearch={setSearch}
          summary={pullRequest.data}
        />
      </Suspense>
    );
  }

  let filesContent: ReactNode;
  if (files.isError) {
    const filesError = toErrorCardProps(files.error, () => files.refetch());
    filesContent = (
      <NoticePanel
        action={
          filesError.onRetry ? (
            <Button className="h-9 px-4" onClick={filesError.onRetry} size="sm">
              Try again
            </Button>
          ) : undefined
        }
        description={filesError.description}
        title={filesError.title}
      />
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
          patches={patchMap}
          pullRequestRef={pullRequestRef}
          symbolIndex={symbolIndex}
        />
      </Suspense>
    );
  }

  return (
    <main className="flex h-svh flex-col overflow-hidden bg-background text-foreground">
      <PullRequestCommands
        files={files.data}
        pullRequest={pullRequest.data}
        setAllViewed={setAllViewed}
        setSearch={setSearch}
      />
      <div className="flex flex-1 flex-col md:hidden">
        <NoticePanel
          description="Open this pull request on a larger screen to review the diff."
          title="Sphynx is better on desktop"
        />
      </div>
      <div className="hidden min-h-0 flex-1 flex-col md:flex">
        {pullRequest.isPending ? (
          <PullRequestHeaderSkeleton pullRequestRef={pullRequestRef} />
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
            tabs={
              <PullRequestTabs
                conversationCount={
                  pullRequest.data.stats.comments +
                  pullRequest.data.stats.reviewComments
                }
                onTabChange={(next) => setSearch({ tab: next })}
                tab={tab}
              />
            }
          />
        )}
        <ReviewAccessBanner
          blockedMessage={accessBlock}
          owner={pullRequestRef.owner}
        />
        {tab === "conversation" ? conversationContent : filesContent}
      </div>
    </main>
  );
}
