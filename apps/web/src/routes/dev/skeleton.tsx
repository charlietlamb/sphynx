import { createFileRoute, notFound } from "@tanstack/react-router";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DossierSkeleton } from "@/components/dashboard/dossier-skeleton";
import { QueueSkeleton } from "@/components/dashboard/queue-skeleton";
import { RailSkeleton } from "@/components/dashboard/rail-skeleton";
import { SwitcherSkeleton } from "@/components/dashboard/switcher-skeleton";

function SkeletonGallery() {
  return (
    <DashboardShell
      dossier={<DossierSkeleton />}
      githubUrl={null}
      hints={null}
      queue={<QueueSkeleton />}
      rail={<RailSkeleton />}
      switcher={<SwitcherSkeleton />}
    />
  );
}

export const Route = createFileRoute("/dev/skeleton")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) {
      throw notFound();
    }
  },
  component: SkeletonGallery,
});
