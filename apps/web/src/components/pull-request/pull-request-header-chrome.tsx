import { Link } from "@tanstack/react-router";
import { UserMenu } from "@/components/auth/user-menu";
import { GithubLink } from "@/components/layout/github-link";
import { SphynxMark } from "@/components/layout/sphynx-mark";
import { SettingsDialog } from "@/components/settings/settings-dialog";

interface PullRequestHeaderChromeProps {
  githubUrl: string;
  label: string;
}

export function PullRequestHeaderChrome({
  githubUrl,
  label,
}: PullRequestHeaderChromeProps) {
  return (
    <div className="flex items-center justify-between gap-2 border-border border-b px-4 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <Link
          aria-label="Sphynx home"
          className="shrink-0 transition-opacity hover:opacity-70"
          to="/"
        >
          <SphynxMark className="size-4" />
        </Link>
        <p className="truncate font-mono text-muted-foreground text-xs">
          {label}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <GithubLink href={githubUrl} />
        <SettingsDialog />
        <UserMenu />
      </div>
    </div>
  );
}
