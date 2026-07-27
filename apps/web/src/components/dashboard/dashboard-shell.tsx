import type { ReactNode } from "react";
import { MosaicDashboardShell } from "@/components/dashboard/mosaic-dashboard-shell";

interface DashboardShellProps {
  dossier: ReactNode;
  githubUrl: string | null;
  queue: ReactNode;
  rail: ReactNode;
  railFooter?: ReactNode;
  switcher: ReactNode;
}

export function DashboardShell(props: DashboardShellProps) {
  return <MosaicDashboardShell {...props} />;
}
