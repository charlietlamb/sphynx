import { createFileRoute, notFound } from "@tanstack/react-router";
import { DashboardPage } from "@/components/dashboard/dashboard-page";

export const Route = createFileRoute("/dev/home")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) {
      throw notFound();
    }
  },
  component: DashboardPage,
});
