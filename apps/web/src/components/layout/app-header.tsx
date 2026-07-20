import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { buttonVariants } from "@sphynx/ui/components/ui/button";
import { Kbd } from "@sphynx/ui/components/ui/kbd";
import { cn } from "@sphynx/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { UserMenu } from "@/components/auth/user-menu";
import { useCommandPalette } from "@/components/command-palette/command-palette-context";
import { GithubLink } from "@/components/layout/github-link";
import { SphynxMark } from "@/components/layout/sphynx-mark";
import { SettingsDialog } from "@/components/settings/settings-dialog";

interface AppHeaderProps {
  githubUrl: string | null;
  switcher: ReactNode;
}

export function AppHeader({ githubUrl, switcher }: AppHeaderProps) {
  const palette = useCommandPalette();
  return (
    <header className="flex items-center justify-between gap-2 border-border border-b px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-4">
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
        <button
          aria-label="Open command palette"
          className={cn(
            buttonVariants({ variant: "outline", size: "icon" }),
            "w-52 justify-start gap-2 px-2.5 font-normal text-muted-foreground/70 text-xs"
          )}
          onClick={() => palette.setOpen(true)}
          type="button"
        >
          <MagnifyingGlassIcon className="size-4 shrink-0 opacity-60" />
          <span className="flex-1 text-left">Search</span>
          <Kbd>⌘K</Kbd>
        </button>
        {githubUrl ? <GithubLink href={githubUrl} /> : null}
        <SettingsDialog />
        <UserMenu />
      </div>
    </header>
  );
}
