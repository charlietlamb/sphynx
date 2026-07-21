import { createFileRoute } from "@tanstack/react-router";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { devOnly } from "@/lib/dev-only";

export const Route = createFileRoute("/dev/skeleton")({
  beforeLoad: devOnly,
  component: DashboardSkeleton,
});
