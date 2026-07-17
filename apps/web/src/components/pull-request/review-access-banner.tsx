import { WarningCircleIcon } from "@phosphor-icons/react";
import { buttonVariants } from "@sphynx/ui/components/ui/button";
import { cn } from "@sphynx/ui/lib/utils";

interface ReviewAccessBannerProps {
  blockedMessage: string | null;
  owner: string;
}

export function ReviewAccessBanner({
  blockedMessage,
  owner,
}: ReviewAccessBannerProps) {
  if (!blockedMessage) {
    return null;
  }
  return (
    <div className="flex items-center gap-2.5 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
      <WarningCircleIcon className="size-4 shrink-0 text-amber-500" />
      <p className="min-w-0 flex-1 truncate text-muted-foreground">
        {blockedMessage}
      </p>
      <a
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        href={`https://github.com/organizations/${owner}/settings/oauth_application_policy`}
        rel="noreferrer"
        target="_blank"
      >
        Review access
      </a>
    </div>
  );
}
