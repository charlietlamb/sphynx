import { Progress } from "@sphynx/ui/components/ui/progress";

interface ViewedProgressProps {
  total: number;
  viewed: number;
}

export function ViewedProgress({ total, viewed }: ViewedProgressProps) {
  return (
    <div className="flex shrink-0 items-center gap-2 text-muted-foreground text-xs">
      <span className="tabular-nums">
        {viewed} / {total} files viewed
      </span>
      <Progress
        className="h-1 w-24"
        value={(viewed / Math.max(total, 1)) * 100}
      />
    </div>
  );
}
