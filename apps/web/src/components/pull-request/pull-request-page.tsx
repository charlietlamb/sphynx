import type { PullRequestRef } from "@sphynx/schema/pull-requests";
import { Navigate, useLocation } from "@tanstack/react-router";
import { lazy, type ReactNode, Suspense, useMemo, useState } from "react";
import { ErrorCard } from "@/components/layout/error-card";
import { NoticePanel } from "@/components/layout/notice-panel";
import { CARD_SURFACE } from "@/components/layout/pane-card";
import { useAccessBlock } from "@/components/pull-request/access-block-store";
import { ConversationSkeleton } from "@/components/pull-request/conversation-skeleton";
import { DiffPanel } from "@/components/pull-request/diff-panel";
import { DiffTrailSlotProvider } from "@/components/pull-request/diff-trail-slot";
import {
  EMPTY_PATCHES,
  EMPTY_SYMBOLS,
} from "@/components/pull-request/patch-map";
import { PullRequestCommands } from "@/components/pull-request/pull-request-commands";
import { PullRequestHeader } from "@/components/pull-request/pull-request-header";
import { PullRequestHeaderSkeleton } from "@/components/pull-request/pull-request-header-skeleton";
import {
  toErrorCardProps,
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
import { useSession } from "@/lib/auth-client";
import { useDocumentTitle } from "@/lib/use-document-title";

const ConversationPanel = lazy(
  () => import("@/components/pull-request/conversation-panel")
);

const conversationSkeleton = <ConversationSkeleton />;

interface PullRequestPageProps {
  pullRequestRef: PullRequestRef;
}

export function PullRequestPage({ pullRequestRef }: PullRequestPageProps) {
  const { pullRequest, patches } = usePullRequest(pullRequestRef);
  const viewed = useViewedFiles(pullRequestRef);
  const freshness = usePullRequestFreshness(
    pullRequestRef,
    pullRequest.data?.head.sha ?? null,
    pullRequest.isFetching
  );
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
          files={patches.data?.files ?? []}
          patches={patchMap}
          pullRequestRef={pullRequestRef}
          setSearch={setSearch}
          summary={pullRequest.data}
        />
      </Suspense>
    );
  }

  const filesContent = (
    <DiffPanel
      data={patches.data}
      error={patches.error}
      headSha={pullRequest.data?.head.sha ?? ""}
      isError={patches.isError}
      isPending={patches.isPending}
      patches={patchMap}
      pullRequestRef={pullRequestRef}
      refetch={() => patches.refetch()}
      symbolIndex={symbolIndex}
      viewed={viewed}
    />
  );
  return (
    <main className="flex h-svh flex-col overflow-hidden bg-background text-foreground">
      <PullRequestCommands
        files={patches.data?.files ?? []}
        pullRequest={pullRequest.data}
        setAllViewed={viewed.setAllViewed}
        setSearch={setSearch}
      />
      <div className="flex flex-1 flex-col md:hidden">
        <NoticePanel
          description="Open this pull request on a larger screen to review the diff."
          title="Sphynx is better on desktop"
        />
      </div>
      <DiffTrailSlotProvider>
        <div className="hidden min-h-0 flex-1 flex-col gap-2.5 p-2.5 md:flex">
          <div className={CARD_SURFACE}>
            {pullRequest.isPending ? (
              <PullRequestHeaderSkeleton pullRequestRef={pullRequestRef} />
            ) : (
              <PullRequestHeader
                canAct={Boolean(session?.user)}
                progress={
                  viewed.viewedFiles && patches.data ? (
                    <ViewedProgress
                      total={patches.data.files.length}
                      viewed={
                        patches.data.files.filter((candidate) =>
                          viewed.viewedFiles?.has(candidate.path)
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
          </div>
          <ReviewAccessBanner
            blockedMessage={accessBlock}
            owner={pullRequestRef.owner}
          />
          <div className="fade-in flex min-h-0 flex-1 animate-in flex-col duration-150">
            {tab === "conversation" ? conversationContent : filesContent}
          </div>
        </div>
      </DiffTrailSlotProvider>
    </main>
  );
}
