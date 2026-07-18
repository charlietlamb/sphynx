import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { UserMenu } from "@/components/auth/user-menu";
import { GithubLink } from "@/components/layout/github-link";
import { SphynxMark } from "@/components/layout/sphynx-mark";
import { SettingsDialog } from "@/components/settings/settings-dialog";

interface DashboardHeaderProps {
  githubUrl: string | null;
  switcher: ReactNode;
}

export function DashboardHeader({ githubUrl, switcher }: DashboardHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-2 border-border border-b py-2 pr-2 pl-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <Link
          aria-label="Sphynx home"
          className="shrink-0 transition-opacity hover:opacity-70"
          to="/"
        >
          <SphynxMark className="size-4" />
        </Link>
        <span
          aria-hidden
          className="-my-2 w-px shrink-0 self-stretch bg-border"
        />
        {switcher}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {githubUrl ? <GithubLink href={githubUrl} /> : null}
        <SettingsDialog />
        <UserMenu />
      </div>
    </header>
  );
}
