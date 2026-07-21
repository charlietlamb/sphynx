import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DossierSkeleton } from "@/components/dashboard/dossier-skeleton";
import { QueueSkeleton } from "@/components/dashboard/queue-skeleton";
import { RailSkeleton } from "@/components/dashboard/rail-skeleton";
import { SwitcherSkeleton } from "@/components/dashboard/switcher-skeleton";

/**
 * The full dashboard shell in its loading state — the same three-pane frame the
 * loaded dashboard renders, so first paint reserves the settled layout instead
 * of flashing blank while the session resolves.
 */
export function DashboardSkeleton() {
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
