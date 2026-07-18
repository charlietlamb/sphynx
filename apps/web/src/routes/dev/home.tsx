import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { devOnly } from "@/lib/dev-only";

export const Route = createFileRoute("/dev/home")({
  beforeLoad: devOnly,
  component: DashboardPage,
});
