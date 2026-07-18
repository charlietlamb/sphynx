import { createFileRoute } from "@tanstack/react-router";
import { DASHBOARD_KEY_HELP } from "@/components/dashboard/dashboard-key-help";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DossierSkeleton } from "@/components/dashboard/dossier-skeleton";
import { KeyHint } from "@/components/dashboard/key-hint";
import { QueueSkeleton } from "@/components/dashboard/queue-skeleton";
import { RailSkeleton } from "@/components/dashboard/rail-skeleton";
import { SwitcherSkeleton } from "@/components/dashboard/switcher-skeleton";
import { devOnly } from "@/lib/dev-only";

function SkeletonGallery() {
  return (
    <DashboardShell
      dossier={<DossierSkeleton />}
      githubUrl={null}
      hints={DASHBOARD_KEY_HELP.map((binding) => (
        <KeyHint
          action={binding.action}
          key={binding.action}
          keys={binding.keys}
        />
      ))}
      queue={<QueueSkeleton />}
      rail={<RailSkeleton />}
      switcher={<SwitcherSkeleton />}
    />
  );
}

export const Route = createFileRoute("/dev/skeleton")({
  beforeLoad: devOnly,
  component: SkeletonGallery,
});
