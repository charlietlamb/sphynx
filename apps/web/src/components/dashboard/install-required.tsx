import { Button } from "@sphynx/ui/components/ui/button";
import { GithubIcon } from "@/components/icons/github-icon";
import { CrosshairCard } from "@/components/layout/crosshair-card";
import { SiteLayout } from "@/components/layout/site-layout";
import { INSTALL_URL } from "@/lib/github-app";

export function InstallRequired() {
  return (
    <SiteLayout center texture>
      <CrosshairCard>
        <h1 className="font-heading text-2xl tracking-tight">
          Connect an organization
        </h1>
        <p className="mt-2 text-muted-foreground text-sm">
          Sphynx reviews pull requests through a GitHub App.
        </p>

        <Button
          className="mt-7 h-10 w-full"
          onClick={() => {
            window.location.href = INSTALL_URL;
          }}
          type="button"
          variant="outline"
        >
          <GithubIcon />
          Install on GitHub
        </Button>

        <p className="mt-4 text-[11px] text-muted-foreground/50 leading-relaxed">
          You'll choose which repositories Sphynx can see. Come back here once
          it's installed.
        </p>
      </CrosshairCard>
    </SiteLayout>
  );
}
