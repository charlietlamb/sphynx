import { ArrowsClockwiseIcon } from "@phosphor-icons/react";
import { Button } from "@sphynx/ui/components/ui/button";
import { cn } from "@sphynx/ui/lib/utils";

interface PullRequestRefreshProps {
  onRefresh: () => void;
  refreshing: boolean;
}

export function PullRequestRefresh({
  onRefresh,
  refreshing,
}: PullRequestRefreshProps) {
  return (
    <Button disabled={refreshing} onClick={onRefresh} size="sm">
      <ArrowsClockwiseIcon className={cn(refreshing && "animate-spin")} />
      New changes
    </Button>
  );
}
