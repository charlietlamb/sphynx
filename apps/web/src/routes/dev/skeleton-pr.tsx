import { createFileRoute } from "@tanstack/react-router";
import { CARD_SURFACE } from "@/components/layout/pane-card";
import { ConversationSkeleton } from "@/components/pull-request/conversation-skeleton";
import { PullRequestHeaderSkeleton } from "@/components/pull-request/pull-request-header-skeleton";
import { WorkspaceSkeleton } from "@/components/pull-request/workspace-skeleton";
import { devOnly } from "@/lib/dev-only";

function PullSkeletonGallery() {
  const { view } = Route.useSearch();
  return (
    <main className="flex h-svh flex-col overflow-hidden bg-background text-foreground">
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-2.5">
        <div className={CARD_SURFACE}>
          <PullRequestHeaderSkeleton
            pullRequestRef={{
              number: 2229,
              owner: "useautumn",
              repo: "autumn",
            }}
          />
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          {view === "conversation" ? (
            <ConversationSkeleton />
          ) : (
            <WorkspaceSkeleton />
          )}
        </div>
      </div>
    </main>
  );
}

export const Route = createFileRoute("/dev/skeleton-pr")({
  validateSearch: (search: Record<string, unknown>) => ({
    view: search.view === "conversation" ? "conversation" : "diff",
  }),
  beforeLoad: devOnly,
  component: PullSkeletonGallery,
});
