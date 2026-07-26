import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { Landing } from "@/components/landing/landing";
import { useSession } from "@/lib/auth-client";
import { getSessionHint } from "@/lib/server/session-hint";

function HomePage() {
  const { likelySignedIn } = Route.useLoaderData();
  const { data: session, isPending } = useSession();
  if (isPending) {
    return likelySignedIn ? <DashboardSkeleton /> : <Landing />;
  }
  return session?.user ? <DashboardPage /> : <Landing />;
}

export const Route = createFileRoute("/")({
  loader: async () => ({ likelySignedIn: await getSessionHint() }),
  component: HomePage,
});
