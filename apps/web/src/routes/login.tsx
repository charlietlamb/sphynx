import { createFileRoute, Navigate } from "@tanstack/react-router";
import { AuthCard } from "@/components/auth/auth-card";
import { SiteLayout } from "@/components/layout/site-layout";
import { useSession } from "@/lib/auth-client";

export const Route = createFileRoute("/login")({
  validateSearch: (search): { redirect?: string } => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  const { data: session, isPending } = useSession();
  if (!isPending && session?.user) {
    return <Navigate href={redirect ?? "/"} replace to="/" />;
  }
  return (
    <SiteLayout center texture>
      <AuthCard redirect={redirect} />
    </SiteLayout>
  );
}
