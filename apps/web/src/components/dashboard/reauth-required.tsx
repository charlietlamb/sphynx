import { Button } from "@sphynx/ui/components/ui/button";
import { GithubIcon } from "@/components/icons/github-icon";
import { CrosshairCard } from "@/components/layout/crosshair-card";
import { SiteLayout } from "@/components/layout/site-layout";
import { signOut } from "@/lib/auth-client";

export function ReauthRequired() {
  return (
    <SiteLayout center texture>
      <CrosshairCard>
        <h1 className="font-heading text-2xl tracking-tight">
          Reconnect GitHub
        </h1>
        <p className="mt-2 text-muted-foreground text-sm">
          Sphynx couldn't reach GitHub with your saved credentials.
        </p>

        <Button
          className="mt-7 h-10 w-full"
          onClick={() =>
            signOut({
              fetchOptions: {
                onSuccess: () => {
                  window.location.href = "/login";
                },
              },
            })
          }
          type="button"
          variant="outline"
        >
          <GithubIcon />
          Sign in again
        </Button>

        <p className="mt-4 text-[11px] text-muted-foreground/50 leading-relaxed">
          Signing in again issues a fresh token. Your queue and settings are
          unaffected.
        </p>
      </CrosshairCard>
    </SiteLayout>
  );
}
