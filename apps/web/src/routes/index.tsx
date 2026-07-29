import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { Landing } from "@/components/landing/landing";
import { useSession } from "@/lib/auth-client";

/**
 * Cross-domain auth keeps the session on the Convex origin, so the server never
 * sees a session cookie for this origin and cannot know at SSR whether the user
 * is signed in. Rather than guess (which flashed the landing hero at signed-in
 * users on every load), render the neutral dashboard skeleton until `useSession`
 * resolves, then commit to the dashboard or the landing page. Signed-in users —
 * who load this route constantly — never see the marketing hero flash; a
 * signed-out visitor sees the skeleton only for the brief resolve window.
 */
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
