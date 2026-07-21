import { ArrowSquareOutIcon, BuildingsIcon } from "@phosphor-icons/react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@sphynx/ui/components/ui/avatar";
import { Button } from "@sphynx/ui/components/ui/button";
import { Skeleton } from "@sphynx/ui/components/ui/skeleton";
import { useInstallations } from "@/components/dashboard/use-installations";
import { SettingRow } from "@/components/settings/setting-row";
import { useSettings } from "@/components/settings/settings-provider";
import { useResync } from "@/components/settings/use-resync";
import { INSTALL_URL } from "@/lib/github-app";

function AccessRowSkeleton({ control }: { control: string }) {
  return (
    <div className="flex items-center justify-between gap-6 py-3.5 first:pt-0 last:pb-0">
      <div className="flex min-w-0 flex-col gap-0.5">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
      <Skeleton
        className="h-7 shrink-0 rounded-md"
        style={{ width: control }}
      />
    </div>
  );
}

function AccessSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col divide-y divide-border">
        <AccessRowSkeleton control="6rem" />
        <AccessRowSkeleton control="4.5rem" />
      </div>
      <Skeleton className="mx-2 h-3.5 w-40" />
    </div>
  );
}

export function SettingsAccess() {
  const { settings } = useSettings();
  const orgs = useInstallations(settings.selectedInstallation, true);
  const resync = useResync(
    orgs.active?.id ?? null,
    orgs.active?.accountLogin ?? "organization"
  );

  if (orgs.isPending) {
    return <AccessSkeleton />;
  }

  if (orgs.isError) {
    return (
      <p className="text-muted-foreground text-xs">
        Couldn't load your GitHub access.
      </p>
    );
  }

  if (!orgs.active) {
    return (
      <p className="text-muted-foreground text-xs">
        Sphynx isn't installed on any organization yet.{" "}
        <a
          className="text-primary underline-offset-2 hover:underline"
          href={INSTALL_URL}
          rel="noreferrer"
          target="_blank"
        >
          Install it on GitHub
        </a>
      </p>
    );
  }

  const active = orgs.active;
  const scope =
    active.repositorySelection === "all"
      ? "All repositories"
      : "Selected repositories";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col divide-y divide-border">
        <SettingRow
          description={`Sphynx acts through this installation. ${scope}.`}
          title="Connected organization"
        >
          <span className="flex items-center gap-2">
            <Avatar className="size-5 rounded-[5px] after:rounded-[5px]">
              <AvatarImage
                alt={active.accountLogin}
                className="rounded-[5px]"
                src={active.avatarUrl ?? undefined}
              />
              <AvatarFallback className="rounded-[5px] text-[9px]">
                {active.accountLogin[0]}
              </AvatarFallback>
            </Avatar>
            <span className="text-[13px]">{active.accountLogin}</span>
          </span>
        </SettingRow>
        {orgs.installations.length > 1 ? (
          <SettingRow
            description="Switch between them from the header."
            title="Other organizations"
          >
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <BuildingsIcon
                aria-hidden
                className="size-3.5 shrink-0"
                weight="fill"
              />
              {orgs.installations.length - 1} more
            </span>
          </SettingRow>
        ) : null}
        <SettingRow
          description="Pull the latest state from GitHub for this organization."
          title="Resync"
        >
          <Button
            disabled={resync.isPending}
            onClick={() => resync.mutate()}
            size="sm"
            variant="outline"
          >
            {resync.isPending ? "Resyncing…" : "Resync"}
          </Button>
        </SettingRow>
      </div>
      <a
        className="flex items-center gap-1.5 px-2 text-muted-foreground/70 text-xs transition-colors hover:text-foreground"
        href={INSTALL_URL}
        rel="noreferrer"
        target="_blank"
      >
        Manage access on GitHub
        <ArrowSquareOutIcon aria-hidden className="size-3 shrink-0" />
      </a>
    </div>
  );
}
