import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { Landing } from "@/components/landing/landing";
import { useSession } from "@/lib/auth-client";

function HomePage() {
  const { data: session, isPending } = useSession();
  if (isPending) {
    return <DashboardSkeleton />;
  }
  return session?.user ? <DashboardPage /> : <Landing />;
}

export const Route = createFileRoute("/")({
  component: HomePage,
});
