import { createFileRoute } from "@tanstack/react-router";
import { CARD_SURFACE } from "@/components/layout/pane-card";
import { PullRequestHeaderSkeleton } from "@/components/pull-request/pull-request-header-skeleton";
import { WorkspaceSkeleton } from "@/components/pull-request/workspace-skeleton";
import { devOnly } from "@/lib/dev-only";

function PullSkeletonGallery() {
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
          <WorkspaceSkeleton />
        </div>
      </div>
    </main>
  );
}

export const Route = createFileRoute("/dev/skeleton-pr")({
  beforeLoad: devOnly,
  component: PullSkeletonGallery,
});
