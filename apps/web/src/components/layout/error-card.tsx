import { CopyButton } from "@sphynx/ui/components/copy-button";
import { Button, buttonVariants } from "@sphynx/ui/components/ui/button";
import { cn } from "@sphynx/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { PanelCard } from "@/components/layout/panel-card";
import { SiteLayout } from "@/components/layout/site-layout";

interface ErrorCardProps {
  description: string;
  detail?: string;
  onRetry?: () => void;
  title: string;
}

export function ErrorCard({
  title,
  description,
  detail,
  onRetry,
}: ErrorCardProps) {
  return (
    <SiteLayout center texture>
      <PanelCard description={description} heading="h1" title={title}>
        {detail ? (
          <div className="relative mt-1">
            <CopyButton
              className="absolute top-1.5 right-1.5"
              label="Copy error"
              value={detail}
            />
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted/40 py-2.5 pr-10 pl-3 font-mono text-muted-foreground text-xs leading-relaxed">
              {detail}
            </pre>
          </div>
        ) : null}
        <div className="mt-3 flex items-center gap-3">
          {onRetry ? (
            <Button
              className="h-9 px-4"
              onClick={onRetry}
              size="sm"
              type="button"
            >
              Try again
            </Button>
          ) : null}
          <Link
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "h-9 px-4"
            )}
            to="/"
          >
            Back home
          </Link>
        </div>
      </PanelCard>
    </SiteLayout>
  );
}
