import { createFileRoute } from "@tanstack/react-router";
import { AuthCard } from "@/components/auth/auth-card";
import { SiteLayout } from "@/components/layout/site-layout";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  return (
    <SiteLayout center texture>
      <AuthCard />
    </SiteLayout>
  );
}
