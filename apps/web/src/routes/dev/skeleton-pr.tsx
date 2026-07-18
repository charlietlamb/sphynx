import { createFileRoute } from "@tanstack/react-router";
import { PullRequestHeaderSkeleton } from "@/components/pull-request/pull-request-header-skeleton";
import { WorkspaceSkeleton } from "@/components/pull-request/workspace-skeleton";
import { devOnly } from "@/lib/dev-only";

function PullSkeletonGallery() {
  return (
    <main className="flex h-svh flex-col overflow-hidden bg-background text-foreground">
      <PullRequestHeaderSkeleton
        pullRequestRef={{ number: 2229, owner: "useautumn", repo: "autumn" }}
      />
      <WorkspaceSkeleton />
    </main>
  );
}

export const Route = createFileRoute("/dev/skeleton-pr")({
  beforeLoad: devOnly,
  component: PullSkeletonGallery,
});
