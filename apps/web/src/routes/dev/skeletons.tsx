import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DossierSkeleton } from "@/components/dashboard/dossier-skeleton";
import { QueueSkeleton } from "@/components/dashboard/queue-skeleton";
import { RailSkeleton } from "@/components/dashboard/rail-skeleton";
import { SwitcherSkeleton } from "@/components/dashboard/switcher-skeleton";
import { devOnly } from "@/lib/dev-only";

export const Route = createFileRoute("/dev/skeletons")({
  beforeLoad: devOnly,
  component: DevSkeletons,
});

function DevSkeletons() {
  return (
    <DashboardShell
      dossier={<DossierSkeleton />}
      githubUrl={null}
      queue={<QueueSkeleton />}
      rail={<RailSkeleton />}
      switcher={<SwitcherSkeleton />}
    />
  );
}
